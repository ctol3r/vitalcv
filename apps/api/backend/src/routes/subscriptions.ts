/**
 * subscriptions.ts — Wave 115: Subscription & API Key Routes
 *
 * POST   /api/subscriptions                    — Create/upgrade subscription
 * GET    /api/subscriptions/:clinicianId        — Get active subscription
 * DELETE /api/subscriptions/:id                — Cancel subscription
 * POST   /api/api-keys                         — Generate API key
 * GET    /api/api-keys/:clinicianId             — List keys for clinician
 * DELETE /api/api-keys/:keyId                  — Revoke key
 */

import type { Express, Request, Response } from 'express';
import {
  createSubscription, cancelSubscription, getSubscriptionByClinicianId,
  TIER_CONFIGS, type SubscriptionTier,
} from '../services/billing/subscriptionService';
import {
  createApiKeyRequestSchema,
  createSubscriptionRequestSchema,
} from '../services/billing/contracts';
import { generateApiKey, revokeApiKey, getApiKeysByClinicianId } from '../services/billing/apiKeyService';
import { log } from '../obs/logger';

function readValidationMessage(error: { issues?: Array<{ message?: string }> }): string {
  return error.issues?.[0]?.message ?? 'Invalid request payload.';
}

export function registerSubscriptionRoutes(app: Express): void {

  // ── POST /api/subscriptions ──────────────────────────────────────
  app.post('/api/subscriptions', async (req: Request, res: Response) => {
    try {
      const parsed = createSubscriptionRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: readValidationMessage(parsed.error) });
        return;
      }

      const { clinicianId, tier, stripeSubId } = parsed.data;
      const sub = await createSubscription(clinicianId, tier as SubscriptionTier, stripeSubId);
      res.status(201).json(sub);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'subscription_create_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/subscriptions/:clinicianId ─────────────────────────
  app.get('/api/subscriptions/:clinicianId', async (req: Request, res: Response) => {
    try {
      const sub = await getSubscriptionByClinicianId(req.params.clinicianId);
      if (!sub) {
        res.status(404).json({ error: 'No active subscription found' });
        return;
      }
      res.json(sub);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── DELETE /api/subscriptions/:id ───────────────────────────────
  app.delete('/api/subscriptions/:id', async (req: Request, res: Response) => {
    try {
      await cancelSubscription(req.params.id);
      res.json({ canceled: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/subscriptions/tiers ────────────────────────────────
  app.get('/api/subscriptions/tiers', (_req: Request, res: Response) => {
    res.json(Object.values(TIER_CONFIGS));
  });

  // ── POST /api/api-keys ──────────────────────────────────────────
  app.post('/api/api-keys', async (req: Request, res: Response) => {
    try {
      const parsed = createApiKeyRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: readValidationMessage(parsed.error) });
        return;
      }

      const { clinicianId, name, tier } = parsed.data;
      const result = await generateApiKey(clinicianId, name, tier);
      res.status(201).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'api_key_create_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/api-keys/:clinicianId ──────────────────────────────
  app.get('/api/api-keys/:clinicianId', async (req: Request, res: Response) => {
    try {
      const keys = await getApiKeysByClinicianId(req.params.clinicianId);
      res.json(keys);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── DELETE /api/api-keys/:keyId ─────────────────────────────────
  app.delete('/api/api-keys/:keyId', async (req: Request, res: Response) => {
    try {
      await revokeApiKey(req.params.keyId);
      res.json({ revoked: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });
}
