import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    atsWebhookId?: string;
    atsSignatureValid?: boolean;
  }
}

export interface AtsVerifyOptions {
  resolveSecret: (webhookId: string) => Promise<string | null> | string | null;
  toleranceSeconds?: number;
  replayWindowSeconds?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;
const DEFAULT_REPLAY_WINDOW_SECONDS = 600;
const replayCache = new Map<string, number>();

export function atsVerifyMiddleware(options: AtsVerifyOptions) {
  const toleranceMs = (options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS) * 1000;
  const replayWindowMs = (options.replayWindowSeconds ?? DEFAULT_REPLAY_WINDOW_SECONDS) * 1000;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhookId =
        (req.headers['x-ats-webhook-id'] as string | undefined) ??
        (req.params?.webhookId as string | undefined);
      const signatureHeader = req.headers['x-ats-signature'] as string | undefined;
      const timestampHeader = req.headers['x-ats-timestamp'] as string | undefined;

      if (!webhookId || !signatureHeader || !timestampHeader) {
        return res.status(401).json({
          error: 'ats_signature_missing',
          message: 'Webhook id, signature, and timestamp headers are required',
        });
      }

      const parsedTimestamp = Date.parse(timestampHeader);
      if (Number.isNaN(parsedTimestamp)) {
        return res.status(401).json({
          error: 'ats_timestamp_invalid',
          message: 'Unable to parse ATS signature timestamp header',
        });
      }

      if (Math.abs(Date.now() - parsedTimestamp) > toleranceMs) {
        return res.status(401).json({
          error: 'ats_timestamp_stale',
          message: 'ATS signature timestamp is outside the acceptable window',
        });
      }

      const secret = await options.resolveSecret(webhookId);
      if (!secret) {
        return res.status(401).json({
          error: 'ats_webhook_unknown',
          message: 'No signing secret registered for this webhook',
        });
      }

      const expectedSignature = computeSignature(secret, timestampHeader, getRawPayload(req));
      const presentedSignature = parseSignature(signatureHeader);

      if (!timingSafeEqual(expectedSignature, presentedSignature)) {
        return res.status(401).json({
          error: 'ats_signature_invalid',
          message: 'ATS signature does not match computed digest',
        });
      }

      if (isReplay(presentedSignature, parsedTimestamp, replayWindowMs)) {
        return res.status(409).json({
          error: 'ats_signature_replay',
          message: 'This ATS signature was already processed',
        });
      }

      req.atsWebhookId = webhookId;
      req.atsSignatureValid = true;
      return next();
    } catch (error) {
      console.error('[ATS] signature verification failed', error);
      return res.status(401).json({
        error: 'ats_verification_failed',
        message: error instanceof Error ? error.message : 'Unknown verification error',
      });
    }
  };
}

function computeSignature(secret: string, timestamp: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

function parseSignature(header: string): string {
  const [version, value] = header.split('=');
  if (value && version.toLowerCase() === 'v1') {
    return value;
  }
  return header.trim();
}

function timingSafeEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function getRawPayload(req: Request): string {
  const raw = (req as any).rawBody;
  if (typeof raw === 'string') {
    return raw;
  }
  if (Buffer.isBuffer(raw)) {
    return raw.toString('utf8');
  }
  if (typeof req.body === 'string') {
    return req.body;
  }
  return JSON.stringify(req.body ?? {});
}

function isReplay(signature: string, timestamp: number, windowMs: number): boolean {
  cleanupReplayCache(windowMs);
  const previous = replayCache.get(signature);
  if (previous && timestamp - previous < windowMs) {
    return true;
  }
  replayCache.set(signature, timestamp);
  return false;
}

function cleanupReplayCache(windowMs: number) {
  if (replayCache.size <= 1000) {
    return;
  }
  const cutoff = Date.now() - windowMs;
  for (const [signature, ts] of replayCache.entries()) {
    if (ts < cutoff) {
      replayCache.delete(signature);
    }
  }
}











