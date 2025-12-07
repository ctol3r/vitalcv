import type { Request, Response, NextFunction } from 'express';

export function locale(req: Request, res: Response, next: NextFunction) {
  // Extract locale from Accept-Language header or query param
  const headerLocale = req.headers['accept-language']?.split(',')[0]?.split('-')[0];
  const queryLocale = req.query.locale as string | undefined;

  // Store locale for use in handlers (defaults to 'en')
  (req as any).locale = queryLocale || headerLocale || 'en';

  next();
}

