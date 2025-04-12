// // middleware/rateLimiter.js
// const rateLimit = require('express-rate-limit');

// // General API rate limiter
// const apiLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // limit each IP to 100 requests per windowMs
//     message: 'Too many requests from this IP, please try again later.',
//     standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
//     legacyHeaders: false, // Disable the `X-RateLimit-*` headers
// });

// // More strict rate limiter for payment-related endpoints
// const paymentLimiter = rateLimit({
//     windowMs: 60 * 60 * 1000, // 1 hour
//     max: 10, // limit each IP to 10 payment requests per hour
//     message: 'Too many payment attempts from this IP, please try again later.',
//     standardHeaders: true,
//     legacyHeaders: false,
// });

// // Specific limiter for payment method operations
// const paymentMethodLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 5, // limit each IP to 5 payment method operations per 15 minutes
//     message: 'Too many payment method operations from this IP, please try again later.',
//     standardHeaders: true,
//     legacyHeaders: false,
// });

// // Form submission limiter
// const formLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 5, // limit each IP to 5 form submissions per window
//     message: 'Too many form submissions from this IP, please try again later.',
//     standardHeaders: true,
//     legacyHeaders: false,
// });

// module.exports = {
//     apiLimiter,
//     paymentLimiter,
//     paymentMethodLimiter,
//     formLimiter
// };

// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Configure rate limiter to work with API testing tools like Postman
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Higher limit for testing purposes
    message: {
        status: 429,
        error: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in test environment
    skip: (req) => process.env.NODE_ENV === 'test',
});

// Stricter limiter for payment endpoints
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 3 payment requests per 15 minutes
    message: {
        status: 429,
        error: 'Too many payment requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // skip: (req) => {
    //     console.log("Rate limit check: ", process.env.NODE_ENV); // Debugging
    //     return process.env.NODE_ENV === 'test';
    // },
    handler: (req, res, next) => {
        console.warn("Rate limit exceeded for IP:", req.ip);
        res.status(429).json({ error: "Too many requests" });
    }
});

module.exports = {
    apiLimiter,
    paymentLimiter
};