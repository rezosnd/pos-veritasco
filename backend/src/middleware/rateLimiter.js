'use strict';

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min
const max = parseInt(process.env.RATE_LIMIT_MAX) || 100;

const keyGenerator = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
};

/**
 * Global rate limiter — applied to all /api routes.
 */
const globalRateLimiter = rateLimit({
  windowMs,
  max,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${keyGenerator(req)}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  },
});

/**
 * Strict rate limiter for auth endpoints.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${keyGenerator(req)}`);
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please wait 15 minutes.',
    });
  },
});

/**
 * Order placement rate limiter.
 */
const orderRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many orders placed. Please wait a moment.',
    });
  },
});

module.exports = { globalRateLimiter, authRateLimiter, orderRateLimiter };
