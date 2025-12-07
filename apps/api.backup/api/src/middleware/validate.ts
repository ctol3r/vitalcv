import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (e: any) {
      return res.status(400).json({ error: 'invalid_input', issues: e?.issues });
    }
  };
}

