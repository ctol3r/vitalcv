import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import type { Request, Response } from 'express';

function acceptsEncoding(headerValue: string, encoding: 'br' | 'gzip'): boolean {
  return headerValue
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .some((part) => part === encoding || part.startsWith(`${encoding};`));
}

export function sendCompressedJson(
  req: Request,
  res: Response,
  payload: unknown,
  options?: {
    enabled?: boolean;
    statusCode?: number;
  },
): void {
  const statusCode = options?.statusCode ?? 200;
  if (!options?.enabled) {
    res.status(statusCode).json(payload);
    return;
  }

  const body = Buffer.from(JSON.stringify(payload));
  const acceptEncoding = String(req.headers['accept-encoding'] ?? '').toLowerCase();

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Vary', 'Accept-Encoding');

  if (acceptsEncoding(acceptEncoding, 'br')) {
    const compressed = brotliCompressSync(body, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
    res.status(statusCode).setHeader('Content-Encoding', 'br');
    res.send(compressed);
    return;
  }

  if (acceptsEncoding(acceptEncoding, 'gzip')) {
    const compressed = gzipSync(body, { level: 6 });
    res.status(statusCode).setHeader('Content-Encoding', 'gzip');
    res.send(compressed);
    return;
  }

  res.status(statusCode).send(body);
}
