// // middleware/recaptchaValidator.js
// const axios = require('axios');

// // Load environment variables
// require('dotenv').config();
// const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

// if (!RECAPTCHA_SECRET_KEY) {
//     console.error('WARNING: RECAPTCHA_SECRET_KEY is not set. reCAPTCHA validation will fail.');
// }

// /**
//  * Middleware to validate reCAPTCHA tokens
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  * @param {Function} next - Express next middleware function
//  */
// const validateRecaptcha = async (req, res, next) => {
//     try {
//         const recaptchaToken = req.body.recaptchaToken;

//         // If no token is provided, reject the request
//         if (!recaptchaToken) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'reCAPTCHA token is required'
//             });
//         }

//         // Verify the token with Google reCAPTCHA API
//         const response = await axios.post(
//             'https://www.google.com/recaptcha/api/siteverify',
//             null,
//             {
//                 params: {
//                     secret: RECAPTCHA_SECRET_KEY,
//                     response: recaptchaToken
//                 }
//             }
//         );

//         // If verification failed, reject the request
//         if (!response.data.success) {
//             console.warn('reCAPTCHA validation failed:', response.data);
//             return res.status(400).json({
//                 success: false,
//                 error: 'reCAPTCHA validation failed'
//             });
//         }

//         // If the score is too low (for v3 reCAPTCHA)
//         if (response.data.score !== undefined && response.data.score < 0.5) {
//             console.warn('reCAPTCHA score too low:', response.data.score);
//             return res.status(400).json({
//                 success: false,
//                 error: 'reCAPTCHA validation failed: score too low'
//             });
//         }

//         // Validation successful, proceed to the next middleware
//         next();
//     } catch (error) {
//         console.error('reCAPTCHA validation error:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Internal server error during reCAPTCHA validation'
//         });
//     }
// };

// module.exports = validateRecaptcha;

// middleware/recaptchaValidator.js
const axios = require('axios');
require('dotenv').config();

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const TEST_MODE = process.env.NODE_ENV === 'test';

/**
 * reCAPTCHA validation middleware with test mode support
 */
const validateRecaptcha = async (req, res, next) => {
    // Skip validation in test mode with test-token
    if (TEST_MODE && req.body.recaptchaToken === 'test-token') {
        return next();
    }

    try {
        const recaptchaToken = req.body.recaptchaToken;

        if (!recaptchaToken) {
            return res.status(400).json({
                success: false,
                error: 'reCAPTCHA token is required'
            });
        }

        // Verify with Google reCAPTCHA API
        const response = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            null,
            {
                params: {
                    secret: RECAPTCHA_SECRET_KEY,
                    response: recaptchaToken
                }
            }
        );

        if (!response.data.success) {
            return res.status(400).json({
                success: false,
                error: 'reCAPTCHA validation failed'
            });
        }

        next();
    } catch (error) {
        console.error('reCAPTCHA validation error:', error);
        res.status(500).json({
            success: false,
            error: 'reCAPTCHA validation error'
        });
    }
};

module.exports = validateRecaptcha;