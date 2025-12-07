/**
 * Demo Mode Middleware
 * Provides utilities for demo mode detection and enforcement
 */

import { Request, Response, NextFunction } from 'express';

export function isDemo(): boolean {
  return process.env.DEMO_MODE === '1';
}

export function demoAllow(_req: Request, _res: Response, next: NextFunction) {
  next();
}

