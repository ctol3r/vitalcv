/**
 * shareTrust.ts — Wave 61: Shareable Trust Links
 *
 * POST /api/share/trust — generate signed trust link + QR payload
 * GET  /api/network/activity — recent trust network events
 */

import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../graphql/prisma_client';

// ── Types ─────────────────────────────────────────────────────────────────

interface ShareTrustBody {
  npi: string;
  expiresInHours?: number;
}

interface TrustShareLink {
  token: string;
  url: string;
  qrPayload: string;
  expiresAt: string;
}

interface NetworkEvent {
  id: string;
  type: 'verification' | 'attestation' | 'revocation';
  description: string;
  npi: string;
  timestamp: string;
}

// ── Token Store (in-memory, TTL) ──────────────────────────────────────────

const tokenStore = new Map<string, { npi: string; expiresAt: number }>();

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function cleanExpired(): void {
  const now = Date.now();
  for (const [token, entry] of tokenStore) {
    if (now > entry.expiresAt) tokenStore.delete(token);
  }
}

// ── Route Registration ────────────────────────────────────────────────────

export function registerShareTrustRoutes(app: Express): void {
  // POST /api/share/trust
  app.post('/api/share/trust', (req: Request, res: Response) => {
    const body = req.body as ShareTrustBody;
    if (!body.npi || !/^\d{10}$/.test(body.npi)) {
      res.status(400).json({ error: 'Valid 10-digit NPI required' });
      return;
    }

    cleanExpired();

    const token = generateToken();
    const expiresInMs = (body.expiresInHours ?? 72) * 60 * 60 * 1000;
    const expiresAt = Date.now() + expiresInMs;

    tokenStore.set(token, { npi: body.npi, expiresAt });

    // TODO: Use actual domain from env
    const baseUrl = process.env.NEXTAUTH_URL ?? 'https://app.vitalcv.com';
    const url = `${baseUrl}/share/${token}`;

    const result: TrustShareLink = {
      token,
      url,
      qrPayload: JSON.stringify({ type: 'vitalcv-trust', token, url }),
      expiresAt: new Date(expiresAt).toISOString(),
    };

    res.json(result);
  });

  // GET /api/share/trust/:token — resolve token to NPI
  app.get('/api/share/trust/:token', (req: Request, res: Response) => {
    const { token } = req.params;
    cleanExpired();

    const entry = tokenStore.get(token);
    if (!entry) {
      res.status(404).json({ error: 'Token expired or not found' });
      return;
    }

    res.json({ npi: entry.npi, expiresAt: new Date(entry.expiresAt).toISOString() });
  });

  // GET /api/network/activity
  app.get('/api/network/activity', async (_req: Request, res: Response) => {
    try {
      const events = await prisma.auditEvent.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, referenceId: true, clinicianId: true, createdAt: true },
      });

      const mapped: NetworkEvent[] = events.map((e) => {
        let eventType: NetworkEvent['type'] = 'verification';
        const et = e.type.toLowerCase();
        if (et.includes('revoc')) eventType = 'revocation';
        else if (et.includes('attest')) eventType = 'attestation';

        return {
          id: e.id,
          type: eventType,
          description: e.type.replace(/_/g, ' '),
          npi: e.clinicianId ?? e.referenceId ?? 'unknown',
          timestamp: e.createdAt.toISOString(),
        };
      });

      res.json({ events: mapped, totalCount: mapped.length, generatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });
}
