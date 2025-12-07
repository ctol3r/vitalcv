import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

/**
 * Middleware to gate realtime streams (SSE/WS) based on runtime flag
 * Allows disabling streams in production if needed
 */
export async function streamsGate(_req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await pool.query(
      'SELECT value FROM "RuntimeFlag" WHERE key = $1',
      ['streams.enabled']
    );

    // If flag explicitly set to false, block the stream
    if (rows.length > 0 && rows[0]?.value === false) {
      return res.status(503).json({
        error: 'streams_disabled',
        message: 'Realtime streams are currently disabled'
      });
    }

    // Default to enabled if flag doesn't exist
    next();
  } catch (err) {
    console.error('Error checking streams gate:', err);
    // Fail open - allow streams if we can't check the flag
    next();
  }
}

