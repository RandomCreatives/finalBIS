const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const multer = require('multer');
const { BadRequestError } = require('../utils/errors');

const parseOrigin = (origin) => {
    try {
        return new URL(origin);
    } catch {
        return null;
    }
};

/**
 * Browser origins are validated by hostname rather than substring matching.
 * This prevents lookalike origins such as https://localhost.evil.example from
 * slipping through while still supporting local development and Arena previews.
 */
const isAllowedOrigin = (origin, env) => {
    if (!origin) return true;
    if (env.corsOrigins.includes(origin)) return true;

    const parsed = parseOrigin(origin);
    if (!parsed) return false;

    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    const isArenaPreview = hostname.endsWith('.e2b.app');

    if (env.isProduction) {
        return false;
    }

    return isLocalhost || isArenaPreview;
};

/**
 * Rate limiters. The auth limiter is deliberately strict and keyed on
 * IP + submitted email so one attacker cannot lock out a whole office,
 * and only failed attempts count toward the limit.
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`,
    message: { message: 'Too many login attempts, please try again in 15 minutes.' },
});

/**
 * Telegram Mini App sign-in limiter. Keyed on the client IP only (the body is
 * untrusted and an attacker can vary it), and successful sign-ins are skipped
 * so normal staff use never consumes the budget. This throttles both password-
 * free credential stuffing and HMAC brute-force attempts.
 */
const telegramLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) =>
        res.statusCode < 400 || res.locals?.telegramVerified === true,
    keyGenerator: (req) => req.ip,
    message: { message: 'Too many Telegram sign-in attempts, please try again in 15 minutes.' },
});

const telegramWebAppLinkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) =>
        `${req.ip}:${String(req.body?.email || req.body?.teacherId || 'class').toLowerCase()}`,
    message: { message: 'Too many link attempts, please try again in 15 minutes.' },
});

/**
 * One-time Telegram link minting. Keyed on the signed-in account (the route
 * sits behind `authenticate`) so a single staff member cannot churn links,
 * with the IP as a fallback. A 10-minute link only needs minting once.
 */
const telegramLinkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`),
    message: { message: 'Too many Telegram link requests, please try again in 15 minutes.' },
});

/** Collects express-validator failures into a single 400. */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    const err = new BadRequestError(details.map((d) => d.message).join('; '));
    err.details = details;
    next(err);
};

/** In-memory upload handler for Excel files (no temp files written to disk). */
const uploadSingle = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new BadRequestError('Only .xlsx, .xls and .csv files are accepted'), false);
        }
    },
}).single('file');

module.exports = {
    apiLimiter,
    authLimiter,
    telegramLimiter,
    telegramWebAppLinkLimiter,
    telegramLinkLimiter,
    validate,
    isAllowedOrigin,
    uploadSingle,
};
