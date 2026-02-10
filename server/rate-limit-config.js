import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: () => process.env.NODE_ENV === 'test' ? 10000 : 5,
    message: {
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: () => process.env.NODE_ENV === 'test'
});

export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: () => process.env.NODE_ENV === 'test' ? 10000 : 100,
    message: {
        error: 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: () => process.env.NODE_ENV === 'test'
});

export const downloadRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: () => process.env.NODE_ENV === 'test' ? 10000 : 10,
    message: {
        error: 'Too many download requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});
