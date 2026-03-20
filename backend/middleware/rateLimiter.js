const rateLimit = require('express-rate-limit');

/** AI routes — 20 requests / 15 min per IP */
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests. Please wait 15 minutes before trying again.' },
});

/** Auth routes — 10 requests / 15 min per IP */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});

/** General API — 100 requests / 15 min */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { aiLimiter, authLimiter, generalLimiter };
