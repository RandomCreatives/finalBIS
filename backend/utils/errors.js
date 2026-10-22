/**
 * Typed application errors. Throwing these from a controller lets the
 * central error handler produce the right status code without every
 * controller needing its own try/catch/res.status boilerplate.
 */

class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Bad request') {
        super(message, 400);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
        super(message, 403);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
    }
}

/**
 * A feature this server knows about cannot run yet — typically a database
 * migration that has not been applied. Distinct from 500: the request was
 * valid, the deployment is incomplete, and the message should tell whoever
 * reads it what to do.
 */
class ServiceUnavailableError extends AppError {
    constructor(message = 'This feature is not available yet') {
        super(message, 503);
    }
}

/**
 * Wraps an async route handler so rejected promises reach Express's
 * error handler instead of hanging the request.
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ServiceUnavailableError,
    asyncHandler,
};
