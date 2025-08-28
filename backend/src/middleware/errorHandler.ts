import { Request, Response, NextFunction } from 'express';

export interface HttpError extends Error {
  status?: number;
  errors?: any;
}

export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status = err.status || 500;
  const response: any = { message: err.message || 'Internal Server Error' };
  if (err.errors) {
    response.errors = err.errors;
  }
  res.status(status).json(response);
}
