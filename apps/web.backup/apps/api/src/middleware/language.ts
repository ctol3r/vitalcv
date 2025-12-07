import type { Request, Response, NextFunction } from 'express';
import { supportedLanguages } from '../utils/i18n';

declare global {
  namespace Express {
    interface Request {
      locale?: string;
    }
  }
}

export function languageMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers['accept-language'];
  if (!header || typeof header !== 'string') {
    req.locale = 'en';
    return next();
  }

  const parsed = parseAcceptLanguage(header);
  const match = parsed.find((entry) =>
    supportedLanguages.some((lang) => lang.toLowerCase() === entry.toLowerCase()),
  );

  req.locale = match ?? 'en';
  return next();
}

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((part) => part.trim().split(';')[0])
    .filter(Boolean);
}










