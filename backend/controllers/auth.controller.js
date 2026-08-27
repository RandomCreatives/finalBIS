const bcrypt = require('bcryptjs');
const env = require('../config/env');
const supabase = require('../config/supabase');
const { signToken } = require('../middleware/auth');
const { UnauthorizedError, NotFoundError, BadRequestError, ConflictError, asyncHandler } = require('../utils/errors');
const { sendMail, smtpConfigured, generateCode } = require('../utils/email');
const { verifyTelegramLogin, sendTelegramMessage } = require('../utils/telegram');

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

/** PATCH /api/auth/profile */
const updateProfile = asyncHandler(async (req, res) => {
    const { name } = req.body;

    const { data, error } = await supabase
        .from('users')
        .update({ name })
        .eq('id', req.user.id)
        .select()
        .single();

    if (error) throw error;

    res.json({ user: publicUser(data), message: 'Profile updated successfully' });
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

    if (identity.telegramId) {
        const msg = `Hello ${data.name}! Your Telegram account (${identity.username ? '@' + identity.username : '#' + identity.telegramId}) is now linked to your BIS NOC staff account (${data.email}). You can now sign in with Telegram.`;
        sendTelegramMessage(identity.telegramId, msg).catch((err) => console.error('[telegram] notification failed:', err.message));
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
 * POST /api/auth/telegram/request-code
 *
 * Step 1 of Telegram OTP login: staff member provides their email or Telegram handle.
 * We find their account, generate a 6-digit OTP, send it via Telegram bot, and save code expiry.
 */
const telegramRequestCode = asyncHandler(async (req, res) => {
    const identifier = (req.body.identifier || req.body.email || '').trim();

    if (!identifier) {
        throw new BadRequestError('Email or Telegram username is required');
    }

    const cleanIdentifier = identifier.replace(/^@/, '').toLowerCase();

    // Query user by email or telegram_username or email match
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .or(`email.ilike.${cleanIdentifier},telegram_username.ilike.${cleanIdentifier}`)
        .maybeSingle();

    if (error) throw error;

    if (!user) {
        throw new UnauthorizedError('No staff account found with that email or Telegram username.');
    }
    if (!user.is_active) {
        throw new UnauthorizedError('Account has been deactivated');
    }
    if (!user.telegram_id) {
        throw new UnauthorizedError('Your account does not have a linked Telegram account yet. Please sign in with your password and link Telegram in Settings.');
    }

    const code = generateCode();
    await supabase
        .from('users')
        .update({
            login_code: code,
            login_code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        })
        .eq('id', user.id)
        .then(({ error: updateErr }) => { if (updateErr) console.error('[auth] Failed to store Telegram login code:', updateErr.message); });

    const msg = `🔑 Your BIS NOC sign-in code is: ${code}

It expires in 10 minutes. Do not share this code with anyone.`;
    const sent = await sendTelegramMessage(user.telegram_id, msg);

    if (!sent) {
        console.log(`[telegram][dev] OTP code for user ${user.email}: ${code}`);
    }

    res.json({
        message: 'Sign-in code sent to your Telegram account!',
        identifier: user.email,
        telegramUsername: user.telegram_username ? `@${user.telegram_username}` : null,
        code: !sent && env.nodeEnv !== 'production' ? code : undefined,
    });
});

/** POST /api/auth/telegram/verify-code — step 2: swap 6-digit Telegram OTP code for a session token. */
const telegramVerifyCode = asyncHandler(async (req, res) => {
    const identifier = (req.body.identifier || req.body.email || '').trim();
    const { code } = req.body;

    if (!code) throw new BadRequestError('Verification code is required');
    if (!identifier) throw new BadRequestError('Email or Telegram username is required');

    const cleanIdentifier = identifier.replace(/^@/, '').toLowerCase();

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .or(`email.ilike.${cleanIdentifier},telegram_username.ilike.${cleanIdentifier}`)
        .maybeSingle();

    if (error) throw error;

    if (!user) throw new UnauthorizedError('No account found');
    if (!user.login_code || user.login_code !== code.trim()) {
        throw new BadRequestError('Invalid verification code');
    }
    if (user.login_code_expires_at && new Date(user.login_code_expires_at) < new Date()) {
        throw new BadRequestError('Code has expired. Request a new one.');
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
        .then(({ error: updateErr }) => { if (updateErr) console.error('[auth] Failed to clear Telegram login code:', updateErr.message); });

    res.json({ token: signToken(user), user: publicUser(user) });
});

module.exports = {
    telegramRequestCode,
    telegramVerifyCode,
    login,
    me,
    changePassword,
    updateProfile,
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
