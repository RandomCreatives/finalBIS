const env = require('../config/env');
const { AppError } = require('../utils/errors');

/** 404 for unmatched routes. */
const notFound = (req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

/**
 * Central error handler. Operational errors surface their message;
 * anything unexpected is logged server-side and reported generically so
 * we never leak internals to the client.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
const errorHandler = (err, req, res, next) => {
    // Handle multer file-size errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5 MB.' });
    }

    const isOperational = err instanceof AppError && err.isOperational;
    const status = err.status || 500;

    if (!isOperational) {
        console.error('[error]', err);
    }

    // `code` and `details` are only ever set explicitly by a controller, so
    // operational errors can tell the client what to do next (e.g. the
    // TELEGRAM_NOT_LINKED hint) without ever leaking internals.
    res.status(status).json({
        message: isOperational ? err.message : 'Internal server error',
        ...(isOperational && err.code ? { code: err.code } : {}),
        ...(isOperational && err.details ? { details: err.details } : {}),
        ...(env.isProduction ? {} : { stack: err.stack }),
    });
};

module.exports = { notFound, errorHandler };
