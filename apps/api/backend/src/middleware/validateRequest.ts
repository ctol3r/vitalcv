import { Request, Response, NextFunction } from "express";

export function validateRequest(
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  // MVP: validation intentionally deferred
  next();
}