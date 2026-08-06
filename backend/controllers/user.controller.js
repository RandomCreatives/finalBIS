const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { publicUser, BCRYPT_ROUNDS } = require('./auth.controller');
const { NotFoundError, ConflictError, BadRequestError, asyncHandler } = require('../utils/errors');

/**
 * Staff management. Admin-only — enforced at the route layer.
 * Every query is scoped to the caller's school_id, so an admin can never
 * read or modify another school's staff.
 */

/** GET /api/users */
const listUsers = asyncHandler(async (req, res) => {
    const { role } = req.query;

    let query = supabase
        .from('users')
        .select('id, name, email, role, is_active, last_login_at, school_id')
        .eq('school_id', req.user.school_id)
        .order('name');

    if (role) query = query.eq('role', role);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ users: data.map(publicUser) });
});

/** POST /api/users */
const createUser = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    const { data: existing, error: lookupError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) throw new ConflictError('A user with that email already exists');

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { data, error } = await supabase
        .from('users')
        .insert({ name, email, password_hash, role, school_id: req.user.school_id })
        .select()
        .single();

    if (error) throw error;

    res.status(201).json({ user: publicUser(data) });
});

/** PATCH /api/users/:id */
const updateUser = asyncHandler(async (req, res) => {
    const { name, role, isActive } = req.body;

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (role !== undefined) patch.role = role;
    if (isActive !== undefined) patch.is_active = isActive;

    if (Object.keys(patch).length === 0) {
        throw new BadRequestError('No updatable fields supplied');
    }

    // Guard against an admin locking themselves out.
    if (req.params.id === req.user.id && (patch.is_active === false || (patch.role && patch.role !== 'admin'))) {
        throw new BadRequestError('You cannot deactivate or demote your own account');
    }

    const { data, error } = await supabase
        .from('users')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('User not found');

    res.json({ user: publicUser(data) });
});

/**
 * DELETE /api/users/:id
 *
 * Soft delete. Staff are referenced by attendance, marksheets and clinic
 * records; deactivating preserves that history and revokes access on the
 * user's next request.
 */
const deactivateUser = asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) {
        throw new BadRequestError('You cannot deactivate your own account');
    }

    const { data, error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('User not found');

    res.json({ message: 'User deactivated', user: publicUser(data) });
});

module.exports = { listUsers, createUser, updateUser, deactivateUser };
