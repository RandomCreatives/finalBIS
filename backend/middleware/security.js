const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const { BadRequestError } = require('../utils/errors');

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

/** Collects express-validator failures into a single 400. */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    const err = new BadRequestError(details.map((d) => d.message).join('; '));
    err.details = details;
    next(err);
};

module.exports = { apiLimiter, authLimiter, validate };
