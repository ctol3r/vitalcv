/**
 * Handoff API — wave-122: Mobile → Web Continuity
 *
 * Mobile calls POST /api/handoff after NPI lookup.
 * Returns a short-lived session token + web passport URL.
 *
 * Web passport reads the session and resumes without re-fetching.
 * No identity drift. No data re-entry.
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

export const handoffRouter = Router();

// ─── In-process session store (replace with Redis/DB for production) ──

interface HandoffSession {
  sessionId: string;
  npi: string;
  readinessSnapshot: {
    posture: string;
    score: number | null;
    lanes: Array<{ laneId: string; status: string; checkedAt: number | null }>;
    nextStep: string | null;
    providerName: string;
  };
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const handoffSessions = new Map<string, HandoffSession>();

// ─── Create Handoff Session ───────────────────────────────────────

/**
 * POST /api/handoff
 * Body: { npi, readinessSnapshot }
 * Returns: { sessionId, webUrl, expiresAt }
 */
handoffRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { npi, readinessSnapshot } = req.body;
    if (!npi || typeof npi !== 'string') {
      return res.status(400).json({ error: 'npi required' });
    }

    const sessionId = randomUUID();
    const now = Date.now();
    const session: HandoffSession = {
      sessionId,
      npi,
      readinessSnapshot: readinessSnapshot ?? null,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };

    handoffSessions.set(sessionId, session);

    // Auto-expire
    setTimeout(() => handoffSessions.delete(sessionId), SESSION_TTL_MS);

    const webUrl = buildWebUrl(npi, sessionId);

    log('info', 'handoff_created', {
      sessionId,
      posture: readinessSnapshot?.posture,
    });

    return res.json({
      sessionId,
      webUrl,
      expiresAt: session.expiresAt,
      npi,
    });
  } catch (err: any) {
    log('error', 'handoff_create_failed', { error: err.constructor?.name });
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Read Handoff Session ─────────────────────────────────────────

/**
 * GET /api/handoff/:sessionId
 * Returns the session data for web to resume.
 */
handoffRouter.get('/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = handoffSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }
  if (Date.now() > session.expiresAt) {
    handoffSessions.delete(sessionId);
    return res.status(410).json({ error: 'Session expired' });
  }

  return res.json({
    sessionId: session.sessionId,
    npi: session.npi,
    readinessSnapshot: session.readinessSnapshot,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  });
});

// ─── Helpers ──────────────────────────────────────────────────────

function buildWebUrl(npi: string, sessionId: string): string {
  const base = process.env.WEB_APP_URL ?? 'https://vitalcv.com';
  return `${base}/passport/${npi}?session=${sessionId}`;
}
