import { Request, Response, NextFunction } from 'express';
import { log } from '../obs/logger';

export interface HttpError extends Error {
  status?: number;
  errors?: any;
}

export function errorHandler(
  err: HttpError,
  req: Request & { requestId?: string },
  res: Response,
  next: NextFunction
) {
  const status = err.status || 500;
  const response: any = { message: err.message || 'Internal Server Error' };
  if (err.errors) {
    response.errors = err.errors;
  }

  log('error', 'http_error', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    status,
    message: err.message,
  });
  res.status(status).json(response);
}
