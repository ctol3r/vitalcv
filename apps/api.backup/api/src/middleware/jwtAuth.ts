/**
 * JWT Authentication middleware for widget endpoints
 */

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const WIDGET_TOKEN_SECRET = process.env.WIDGET_TOKEN_SECRET || 'widget-secret-change-in-production';

export function jwtAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    // Verify and decode token
    const decoded = jwt.verify(token, WIDGET_TOKEN_SECRET, {
      algorithms: ['HS256'],
    });

    // Attach decoded token to request
    (req as any).auth = decoded;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'token_expired',
        message: 'Widget token has expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Invalid widget token',
      });
    }

    return res.status(401).json({
      error: 'authentication_failed',
      message: 'Authentication failed',
    });
  }
}

