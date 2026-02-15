import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestLatencyMetrics } from '../observability/requestMetrics';
import { log } from '../obs/logger';

function buildRequestLog(
  requestId: string,
  req: Request,
  res: Response,
  latencyMs: number,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    event: 'http_request',
    request_id: requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    status_code: res.statusCode,
    latency_ms: Number(latencyMs.toFixed(2)),
    user_agent: req.get('user-agent') ?? null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
}

export function requestObservability(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.get('x-request-id') || randomUUID()).trim();
  const startedAt = process.hrtime.bigint();

  res.locals.request_id = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const latencyMs = Number(elapsedNs) / 1_000_000;
    requestLatencyMetrics.record(latencyMs, res.statusCode);

    if (res.statusCode >= 500) {
      log('error', 'http_request_error', buildRequestLog(requestId, req, res, latencyMs));
    } else {
      log('info', 'http_request', buildRequestLog(requestId, req, res, latencyMs));
    }
  });

  next();
}
