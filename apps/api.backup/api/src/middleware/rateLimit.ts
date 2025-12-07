import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for agent endpoints
 * Prevents abuse and excessive API calls
 */
export const agentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many agent requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for admin operations
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many admin requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Lenient rate limiter for feedback
 */
export const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 feedback submissions per minute
  message: 'Too many feedback submissions, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

