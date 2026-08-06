const jwt = require('jsonwebtoken');
const env = require('../config/env');
const supabase = require('../config/supabase');
const { UnauthorizedError, ForbiddenError, asyncHandler } = require('../utils/errors');

const ROLES = {
    ADMIN: 'admin',
    MAIN_TEACHER: 'main_teacher',
    ASSISTANT_TEACHER: 'assistant_teacher',
    SUBJECT_TEACHER: 'subject_teacher',
};

const ALL_ROLES = Object.values(ROLES);
const TEACHER_ROLES = [ROLES.MAIN_TEACHER, ROLES.ASSISTANT_TEACHER, ROLES.SUBJECT_TEACHER];

/** Signs a short-lived access token. */
const signToken = (user) =>
    jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
        issuer: 'bisnoc-sms',
        audience: 'bisnoc-sms-client',
    });

/**
 * Verifies the bearer token and loads the live user record.
 *
 * The DB lookup on every request is deliberate: it means deactivating a
 * user takes effect immediately rather than when their token expires.
 */
const authenticate = asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
        throw new UnauthorizedError('Authentication required');
    }

    const token = header.slice(7).trim();

    let payload;
    try {
        payload = jwt.verify(token, env.jwtSecret, {
            issuer: 'bisnoc-sms',
            audience: 'bisnoc-sms-client',
        });
    } catch (err) {
        throw new UnauthorizedError(
            err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token'
        );
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, role, school_id, is_active')
        .eq('id', payload.sub)
        .maybeSingle();

    if (error) throw error;
    if (!user) throw new UnauthorizedError('Account no longer exists');
    if (!user.is_active) throw new UnauthorizedError('Account has been deactivated');

    req.user = user;
    next();
});

/**
 * Restricts a route to the given roles. Always used after `authenticate`.
 *
 *   router.post('/', authenticate, authorize(ROLES.ADMIN), handler)
 */
const authorize = (...roles) => (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());

    if (!roles.includes(req.user.role)) {
        return next(new ForbiddenError());
    }

    next();
};

module.exports = { authenticate, authorize, signToken, ROLES, ALL_ROLES, TEACHER_ROLES };
