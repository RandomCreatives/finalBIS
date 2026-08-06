const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { signToken } = require('../middleware/auth');
const { UnauthorizedError, NotFoundError, BadRequestError, asyncHandler } = require('../utils/errors');

const BCRYPT_ROUNDS = 12;

/** Shape a user row for the client. Never returns password_hash. */
const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    schoolId: u.school_id,
    isActive: u.is_active,
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

module.exports = { login, me, changePassword, publicUser, BCRYPT_ROUNDS };
