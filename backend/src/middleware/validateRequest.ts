import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { HttpError } from './errorHandler';

export function validateRequest(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err: HttpError = new Error('Invalid request');
    err.status = 400;
    err.errors = errors.array();
    return next(err);
  }
  next();
}
