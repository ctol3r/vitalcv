/**
 * Readonly Mode Middleware
 * B150B-DR-007
 *
 * Express middleware to enforce readonly mode.
 * Should be mounted early in the middleware chain, after authentication.
 */

import { Request, Response, NextFunction } from 'express';
import { readonlyModeMiddleware } from '../config/readonlyMode';

// Re-export the middleware for convenience
export { readonlyModeMiddleware };

// Also export as default for easier imports
export default readonlyModeMiddleware;

