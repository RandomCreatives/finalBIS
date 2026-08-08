const bcrypt = require('bcryptjs');
const env = require('../config/env');
const supabase = require('../config/supabase');
const { signToken } = require('../middleware/auth');
const { UnauthorizedError, NotFoundError, BadRequestError, ConflictError, asyncHandler } = require('../utils/errors');
const { sendMail, smtpConfigured, generateCode } = require('../utils/email');

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
        .eq('id', user.id);

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
        .eq('id', user.id);

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
        .eq('id', user.id);

    res.json({ token: signToken(user), user: publicUser(user) });
});

module.exports = {
    login,
    me,
    changePassword,
    updateProfile,
    sendVerificationCode,
    verifyCode,
    gmailRequestCode,
    gmailVerifyCode,
    publicUser,
    BCRYPT_ROUNDS,
};
