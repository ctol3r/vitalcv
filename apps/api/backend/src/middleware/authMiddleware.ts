import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
  if (clerkUserId) {
    (req as any).isAuthenticated = true;
    (req as any).clerkUserId = clerkUserId;
  } else {
    (req as any).isAuthenticated = false;
  }
  next();
}