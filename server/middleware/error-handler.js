import logger from '../logger.js';

export function errorHandler(err, req, res, next) {
    logger.error({
        err,
        method: req.method,
        url: req.url,
        ip: req.ip
    }, 'Request error');

    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || err.status || 500;

    if (process.env.NODE_ENV === 'production') {
        res.status(statusCode).json({
            error: statusCode === 500
                ? 'An internal server error occurred'
                : err.message || 'An error occurred'
        });
    } else {
        res.status(statusCode).json({
            error: err.message || 'An error occurred',
            stack: err.stack,
            details: err.details || undefined
        });
    }
}
