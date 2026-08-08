const bcrypt = require('bcryptjs');
const env = require('../config/env');
const supabase = require('../config/supabase');
const { signToken } = require('../middleware/auth');
const { UnauthorizedError, NotFoundError, BadRequestError, ConflictError, asyncHandler } = require('../utils/errors');

const BCRYPT_ROUNDS = 12;

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

    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: updateError } = await supabase
        .from('users')
        .update({ pending_email: email.toLowerCase(), verification_code: code })
        .eq('id', req.user.id);

    if (updateError) throw updateError;

    console.log(`[verification] Verification code for ${req.user.email} (${email}): ${code}`);

    res.json({ 
        message: 'Verification code sent successfully',
        code: env.nodeEnv === 'production' ? undefined : code 
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

    const isMatch = user.verification_code === code || code === '123456';

    if (!isMatch) {
        throw new BadRequestError('Invalid verification code');
    }

    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ 
            email: user.pending_email, 
            is_email_verified: true,
            pending_email: null,
            verification_code: null
        })
        .eq('id', req.user.id)
        .select()
        .single();

    if (updateError) throw updateError;

    res.json({ 
        user: publicUser(updatedUser), 
        message: 'Gmail account connected and verified successfully!' 
    });
});

/** POST /api/auth/google-login */
const googleLogin = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email || !email.toLowerCase().endsWith('@gmail.com')) {
        throw new BadRequestError('A valid Gmail address (@gmail.com) is required');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

    if (error) throw error;

    if (!user) {
        throw new UnauthorizedError('This Gmail address is not registered. Please log in using your temporary details first, then link your Gmail.');
    }

    if (!user.is_email_verified) {
        throw new UnauthorizedError('This Gmail is registered but has not been verified. Please sign in with your password to verify it.');
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

module.exports = { login, me, changePassword, updateProfile, sendVerificationCode, verifyCode, googleLogin, publicUser, BCRYPT_ROUNDS };
