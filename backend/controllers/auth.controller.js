const bcrypt = require('bcryptjs');
const env = require('../config/env');
const supabase = require('../config/supabase');
const { signToken } = require('../middleware/auth');
const { UnauthorizedError, NotFoundError, BadRequestError, ConflictError, ForbiddenError, asyncHandler } = require('../utils/errors');
const { sendMail, smtpConfigured, generateCode } = require('../utils/email');
const { verifyTelegramLogin } = require('../utils/telegram');

const BCRYPT_ROUNDS = 12;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Deliver a 6-digit code to the given address. Returns true if SMTP sent it. */
const deliverCode = async (to, code, purpose) => {
    const subject = purpose === 'login' ? 'Your sign-in code' : 'Verify your Gmail address';
    const text =
        purpose === 'login'
            ? `Your BIS NOC sign-in code is ${code}. It expires in 10 minutes.`
            : `Your BIS NOC verification code is ${code}. It expires in 10 minutes.`;
    const sent = await sendMail({
        to,
        subject,
        text,
        html: `<p>Your BIS NOC ${purpose === 'login' ? 'sign-in code' : 'verification code'} is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 10 minutes.</p>`,
    });
    if (!sent) {
        console.log(`[email][dev] ${purpose} code for ${to}: ${code}`);
    }
    return sent;
};

/** Shape a user row for the client. Never returns password_hash. */
const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    role: u.role,
    schoolId: u.school_id,
    isActive: u.is_active,
    isEmailVerified: u.is_email_verified ?? false,
    lastLoginAt: u.last_login_at ?? null,
    telegramId: u.telegram_id ?? null,
    telegramUsername: u.telegram_username ?? null,
});

/**
 * POST /api/auth/login
 *
 * One login path for every role. Admins and teachers both live in `users`
 * and are both verified with bcrypt — there is no plaintext branch.
 */
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;

    // Compare against a dummy hash when the user is absent so that response
    // timing does not reveal which emails exist.
    const hash = user?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const passwordOk = await bcrypt.compare(password, hash);

    if (!user || !passwordOk) {
        throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.is_active) {
        throw new UnauthorizedError('Account has been deactivated');
    }

    await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(({ error }) => { if (error) console.error('[auth] Failed to update last_login_at:', error.message); });

    res.json({ token: signToken(user), user: publicUser(user) });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
});

/**
 * Telegram widget sign-in feature flag — read per request (not captured at
 * boot) so it can be flipped without a redeploy while the bot is finished.
 */
const telegramLoginEnabled = () =>
    String(process.env.TELEGRAM_LOGIN_ENABLED || '').toLowerCase() === 'true';

/** PATCH /api/auth/password */
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const { data: user, error } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', req.user.id)
        .maybeSingle();

    if (error) throw error;
    if (!user) throw new NotFoundError('User not found');

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) throw new BadRequestError('Current password is incorrect');

    const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash })
        .eq('id', req.user.id);

    if (updateError) throw updateError;

    res.json({ message: 'Password updated successfully' });
});

/**
 * PATCH /api/auth/profile
 * Self-service contact details. Display names are school-managed: only
 * admins may change their own name; for other roles a name change is
 * rejected because names drive the public card walls, seats and printouts.
 */
const PHONE_RE = /^[+\d][\d\s\-()]{5,19}$/;

const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone } = req.body;
    const patch = {};

    if (name !== undefined) {
        if (req.user.role !== 'admin') {
            throw new ForbiddenError('Your display name is managed by the school — ask the administrator to correct it');
        }
        patch.name = String(name).trim();
    }

    if (phone !== undefined) {
        const trimmed = String(phone).trim();
        if (trimmed && !PHONE_RE.test(trimmed)) {
            throw new BadRequestError('Enter a valid phone number (digits, spaces, dashes and a leading + only)');
        }
        patch.phone = trimmed || null;
    }

    if (Object.keys(patch).length === 0) throw new BadRequestError('Nothing to update');

    const { data, error } = await supabase
        .from('users')
        .update(patch)
        .eq('id', req.user.id)
        .select()
        .single();

    if (error) throw error;

    res.json({ user: publicUser(data), message: 'Profile updated successfully' });
});

/** The basic credential every subject-teacher seat starts (and resets) to. */
const SUBJECT_BASIC_PASSWORD = 'BisNoc2026!';

/**
 * POST /api/auth/reset-password/:userId  (admin only)
 *
 * "Reset to basic": when a teacher loses their personal password, an
 * administrator resets the account back to its known basic credential —
 *   · subject teachers → the shared placeholder BisNoc2026!
 *   · main teachers    → their class card password (the class name)
 * The teacher then signs in with email + basic and sets their own password.
 */
const resetUserPassword = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const { data: target, error } = await supabase
        .from('users')
        .select('id, name, role, is_active')
        .eq('id', userId)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!target) throw new NotFoundError('Account not found');
    if (target.role === 'admin') {
        throw new BadRequestError('Administrator passwords are rotated manually, not through reset.');
    }

    let basic = SUBJECT_BASIC_PASSWORD;
    let describe = `the placeholder password (${SUBJECT_BASIC_PASSWORD})`;

    if (target.role === 'main_teacher') {
        const { data: year, error: yearError } = await supabase
            .from('academic_years')
            .select('id')
            .eq('school_id', req.user.school_id)
            .eq('is_current', true)
            .maybeSingle();
        if (yearError) throw yearError;

        const seatResult = year ? await supabase
            .from('class_staff')
            .select('class_id')
            .eq('academic_year_id', year.id)
            .eq('user_id', target.id)
            .eq('position', 'main')
            .maybeSingle() : { data: null, error: null };
        if (seatResult.error) throw seatResult.error;
        if (!seatResult.data) {
            throw new BadRequestError('This account seats no class as main teacher this year — rotate its password manually.');
        }

        const { data: klass, error: classError } = await supabase
            .from('classes')
            .select('name')
            .eq('id', seatResult.data.class_id)
            .maybeSingle();
        if (classError) throw classError;

        // The literal the teacher types into the email sign-in — the same
        // normalization the login screen documents ('Year 3 - Blue' ->
        // 'year 3 blue'). bcrypt compares exactly, no fuzzy matching here.
        basic = klass.name.toLowerCase().replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
        describe = `the class card password (${basic})`;
    }

    const password_hash = await bcrypt.hash(basic, BCRYPT_ROUNDS);
    const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash })
        .eq('id', target.id);
    if (updateError) throw updateError;

    res.json({
        message: `${target.name}'s password was reset to ${describe}. Ask them to sign in and set their own.`,
        basic,
    });
});

/** POST /api/auth/send-verification-code */
const sendVerificationCode = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email || !email.toLowerCase().endsWith('@gmail.com')) {
        throw new BadRequestError('A valid Gmail address (@gmail.com) is required');
    }

    // Check if another user already has this email
    const { data: existing, error: lookupError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', req.user.id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) {
        throw new ConflictError('This Gmail address is already linked to another account');
    }

    const code = generateCode();

    const { error: updateError } = await supabase
        .from('users')
        .update({
            pending_email: email.toLowerCase(),
            verification_code: code,
            verification_code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        })
        .eq('id', req.user.id);

    if (updateError) throw updateError;

    const sent = await deliverCode(email.toLowerCase(), code, 'verify');

    res.json({
        message: 'Verification code sent successfully',
        // Only surfaced in development (where SMTP is usually unset); the
        // code also appears in the server log there.
        code: !sent && env.nodeEnv !== 'production' ? code : undefined,
    });
});

/** POST /api/auth/verify-code */
const verifyCode = asyncHandler(async (req, res) => {
    const { code } = req.body;

    if (!code) throw new BadRequestError('Verification code is required');

    const { data: user, error: lookupError } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.user.id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!user) throw new NotFoundError('User not found');

    if (!user.verification_code || user.verification_code !== code) {
        throw new BadRequestError('Invalid verification code');
    }
    if (user.verification_code_expires_at && new Date(user.verification_code_expires_at) < new Date()) {
        throw new BadRequestError('Verification code has expired. Request a new one');
    }

    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
            email: user.pending_email,
            is_email_verified: true,
            pending_email: null,
            verification_code: null,
            verification_code_expires_at: null,
        })
        .eq('id', req.user.id)
        .select()
        .single();

    if (updateError) throw updateError;

    res.json({
        user: publicUser(updatedUser),
        message: 'Gmail account connected and verified successfully!',
    });
});

/**
 * POST /api/auth/gmail/request
 *
 * Step one of the passwordless sign-in: a verified Gmail address requests a
 * code. One is emailed (or logged, in dev) and stored against the account for
 * 10 minutes. No session is issued from this call alone.
 */
const gmailRequestCode = asyncHandler(async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();

    if (!email || !email.endsWith('@gmail.com')) {
        throw new BadRequestError('A valid Gmail address (@gmail.com) is required');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;

    if (!user) {
        throw new UnauthorizedError('This Gmail address is not registered. Sign in with your password and link it from Settings first.');
    }
    if (!user.is_email_verified) {
        throw new UnauthorizedError('This Gmail address has not been verified yet. Sign in with your password and verify it in Settings.');
    }
    if (!user.is_active) {
        throw new UnauthorizedError('Account has been deactivated');
    }

    const code = generateCode();
    await supabase
        .from('users')
        .update({
            login_code: code,
            login_code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        })
        .eq('id', user.id)
        .then(({ error }) => { if (error) console.error('[auth] Failed to store login code:', error.message); });

    const sent = await deliverCode(email, code, 'login');

    res.json({
        message: 'Sign-in code sent successfully',
        email,
        // Dev-only convenience; in production the code only arrives by email.
        code: !sent && env.nodeEnv !== 'production' ? code : undefined,
    });
});

/** POST /api/auth/gmail/verify — step two: swap the code for a session. */
const gmailVerifyCode = asyncHandler(async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    const { code } = req.body;

    if (!code) throw new BadRequestError('Verification code is required');

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;

    if (!user) throw new UnauthorizedError('This Gmail address is not registered');
    if (!user.login_code || user.login_code !== code) {
        throw new BadRequestError('Invalid verification code');
    }
    if (user.login_code_expires_at && new Date(user.login_code_expires_at) < new Date()) {
        throw new BadRequestError('Code has expired. Request a new one');
    }
    if (!user.is_active) {
        throw new UnauthorizedError('Account has been deactivated');
    }

    await supabase
        .from('users')
        .update({
            login_code: null,
            login_code_expires_at: null,
            last_login_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .then(({ error }) => { if (error) console.error('[auth] Failed to clear login code:', error.message); });

    res.json({ token: signToken(user), user: publicUser(user) });
});

/**
 * POST /api/auth/telegram
 *
 * Exchange a verified Telegram Login Widget payload for a session. The widget
 * runs client-side; the signature is checked here against the bot token, so
 * the identity cannot be forged. The Telegram account must be linked to a
 * staff account first (admins do that from the Staff page).
 */
const telegramLogin = asyncHandler(async (req, res) => {
    // Sign-in via Telegram is temporarily grayed out while the bot function
    // is being finished. Account linking (link-telegram) is unaffected.
    if (!telegramLoginEnabled()) {
        throw new ForbiddenError('Telegram sign-in is temporarily disabled while the Telegram bot is being finished. Use your email and password.');
    }

    // Guard: if the bot token is missing, this is a server config problem,
    // not a user error. Distinguish clearly so an admin can diagnose it.
    if (!env.telegram.botToken) {
        throw new BadRequestError(
            'Telegram sign-in is not configured on this server. Contact your administrator.'
        );
    }

    const identity = verifyTelegramLogin(req.body, env.telegram.botToken);

    if (!identity) {
        throw new UnauthorizedError('Telegram login could not be verified. Please try again');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', identity.telegramId)
        .maybeSingle();

    if (error) throw error;

    if (!user) {
        throw new UnauthorizedError(
            'This Telegram account is not linked to any BIS NOC login. Ask an administrator to link it from the Staff page.'
        );
    }
    if (!user.is_active) {
        throw new UnauthorizedError('Account has been deactivated');
    }

    // Keep the stored username fresh — Telegram lets people change it, and
    // accounts linked by numeric id alone may not have had one yet.
    const loginPatch = { last_login_at: new Date().toISOString() };
    if (identity.username) loginPatch.telegram_username = identity.username;

    await supabase
        .from('users')
        .update(loginPatch)
        .eq('id', user.id)
        .then(({ error }) => { if (error) console.error('[auth] Failed to update telegram login:', error.message); });

    res.json({ token: signToken(user), user: publicUser(user) });
});

/**
 * GET /api/auth/telegram-config
 *
 * Public (no session needed — it is read on the login page). Exposes only
 * the bot's public username, which is visible to everyone on Telegram
 * anyway. This makes the backend env the single source of truth: the login
 * widget and the Settings linking card no longer depend on a build-time
 * REACT_APP_* variable.
 */
const telegramConfig = asyncHandler(async (req, res) => {
    const enabled = Boolean(env.telegram.botUsername && env.telegram.botToken);
    res.json({
        enabled,
        botUsername: enabled ? env.telegram.botUsername : null,
        // The widget login is grayed out until the bot function is finished;
        // account linking from the profile page remains available.
        loginEnabled: enabled && telegramLoginEnabled(),
    });
});

/**
 * POST /api/auth/link-telegram
 *
 * Self-service linking. The staff member is already signed in (password or
 * Gmail code); they click the Telegram Login Widget in Settings and we
 * attach the verified Telegram identity to THEIR account. The signature is
 * verified exactly like at sign-in, so a payload cannot be forged, and the
 * unique index guarantees one Telegram account maps to one staff login.
 */
const linkTelegram = asyncHandler(async (req, res) => {
    if (!env.telegram.botToken) {
        throw new BadRequestError(
            'Telegram sign-in is not configured on this server. Contact your administrator.'
        );
    }

    const identity = verifyTelegramLogin(req.body, env.telegram.botToken);

    if (!identity) {
        throw new UnauthorizedError('Telegram login could not be verified. Please try again');
    }

    const { data: existing, error: lookupError } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', identity.telegramId)
        .neq('id', req.user.id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) {
        throw new ConflictError('That Telegram account is already linked to another staff member');
    }

    const { data, error } = await supabase
        .from('users')
        .update({ telegram_id: identity.telegramId, telegram_username: identity.username })
        .eq('id', req.user.id)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new ConflictError('That Telegram account is already linked to another staff member');
        }
        throw error;
    }

    res.json({ user: publicUser(data), message: 'Telegram account linked. You can now sign in with Telegram.' });
});

/** DELETE /api/auth/link-telegram — remove Telegram sign-in from my account. */
const unlinkTelegram = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .update({ telegram_id: null, telegram_username: null })
        .eq('id', req.user.id)
        .select()
        .single();

    if (error) throw error;

    res.json({ user: publicUser(data), message: 'Telegram account unlinked' });
});

/**
 * POST /api/auth/class-login — demo-stage class-card sign-in.
 *
 * Each class has its own login: the password is the class name itself
 * (compared case-insensitively, punctuation-insensitive, so "year 4 blue"
 * matches "Year 4 - Blue"). A correct password signs in the class's main
 * teacher — issuing a real JWT — so the class dashboard can use the full
 * teacher-scoped API (rosters, edits, transfers).
 *
 * This gate is explicitly temporary; the sign-in redesign supersedes it.
 */
const normalizeClassPassword = (s) =>
    String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * GET /api/auth/subject-teachers — card directory for the subject-teacher
 * sign-in page. Returns only the safe fields needed to render the cards
 * (names are already public on the /teachers page); the password still
 * guards the actual sign-in.
 */
const listSubjectTeachers = asyncHandler(async (req, res) => {
    const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) throw new NotFoundError('School not found');

    const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('school_id', school.id)
        .eq('role', 'subject_teacher')
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    // Shape explicitly: the response guarantees only safe fields, whatever
    // the query layer returns.
    res.json({ teachers: (data || []).map((t) => ({ id: t.id, name: t.name })) });
});

/**
 * POST /api/auth/subject-teacher-login — teacher-card sign-in.
 *
 * Each subject teacher has a card on the sign-in page; the card carries the
 * teacher's id and the dialog asks for their account password. Verification
 * is the same bcrypt path as the normal login — this endpoint simply spares
 * teachers from typing machine-generated email addresses.
 */
const subjectTeacherLogin = asyncHandler(async (req, res) => {
    const { teacherId, password } = req.body;

    const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) throw new NotFoundError('School not found');

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('school_id', school.id)
        .eq('id', teacherId)
        .maybeSingle();

    if (error) throw error;

    // Same dummy-hash timing defence as the main login.
    const hash = user?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const passwordOk = await bcrypt.compare(password, hash);

    if (!user || !passwordOk) {
        throw new UnauthorizedError('Incorrect password for that teacher');
    }

    if (user.role !== 'subject_teacher') {
        throw new UnauthorizedError('That card is not a subject-teacher account');
    }

    if (!user.is_active) {
        throw new UnauthorizedError('Account has been deactivated');
    }

    await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(({ error: e }) => { if (e) console.error('[auth] Failed to update last_login_at:', e.message); });

    res.json({ token: signToken(user), user: publicUser(user) });
});

const classLogin = asyncHandler(async (req, res) => {
    const { className, password } = req.body;

    const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) throw new NotFoundError('School not found');

    const { data: klass, error: classError } = await supabase
        .from('classes')
        .select('id, name, year_level, capacity')
        .eq('school_id', school.id)
        .ilike('name', className)
        .maybeSingle();

    if (classError) throw classError;
    if (!klass) throw new NotFoundError('Class not found');

    if (normalizeClassPassword(password) !== normalizeClassPassword(klass.name)) {
        throw new UnauthorizedError('Incorrect class password');
    }

    // The class's main teacher for the current year becomes the identity.
    const { data: year, error: yearError } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', school.id)
        .eq('is_current', true)
        .maybeSingle();

    if (yearError) throw yearError;
    if (!year) throw new NotFoundError('No current academic year is set');

    const { data: seat, error: seatError } = await supabase
        .from('class_staff')
        .select('user_id')
        .eq('academic_year_id', year.id)
        .eq('class_id', klass.id)
        .eq('position', 'main')
        .maybeSingle();

    if (seatError) throw seatError;
    if (!seat) throw new UnauthorizedError('This class has no main teacher assigned yet');

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', seat.user_id)
        .maybeSingle();

    if (userError) throw userError;
    if (!user) throw new UnauthorizedError('Teacher account not found');
    if (!user.is_active) throw new UnauthorizedError('This teacher account is deactivated');

    await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

    res.json({
        token: signToken(user),
        user: publicUser(user),
        class: { id: klass.id, name: klass.name, yearLevel: klass.year_level, capacity: klass.capacity },
    });
});

module.exports = {
    login,
    classLogin,
    listSubjectTeachers,
    subjectTeacherLogin,
    me,
    changePassword,
    updateProfile,
    resetUserPassword,
    sendVerificationCode,
    verifyCode,
    gmailRequestCode,
    gmailVerifyCode,
    telegramLogin,
    telegramConfig,
    linkTelegram,
    unlinkTelegram,
    publicUser,
    BCRYPT_ROUNDS,
};
