/**
 * apiKeys.ts — Wave 115: API Key Routes
 *
 * POST   /api/api-keys                         — Generate API key
 * GET    /api/api-keys/:clinicianId             — List keys for clinician
 * DELETE /api/api-keys/:keyId                  — Revoke key
 *
 * AUTHORIZATION (2026-08-08). These three routes had NO authorization of any
 * kind. They sit behind the global tenant guard, which accepted the mere
 * PRESENCE of a caller-supplied `x-org-id`, so an anonymous caller who set one
 * header reached all three: mint a key for an arbitrary `clinicianId` taken
 * straight from the body, list any clinician's keys, revoke any key by id.
 * `generateApiKey` validates nothing and `revokeApiKey` checks no ownership.
 *
 * They are NOT currently exploitable, and the reason is an accident rather than
 * a control: `apiKeyService` targets `prisma.subscriptionApiKey` using the
 * *`ApiKey`* model's fields (`keyHash`, `name`), while SubscriptionApiKey has
 * neither and requires `organizationId` + `apiKey`. Every call therefore throws
 * — which is exactly what `GET /api/api-keys/<uuid>` returns in production
 * today (500, past the tenant guard). The moment that drift is repaired these
 * become anonymous mint/revoke of billing keys, and minting is privileged:
 * `middleware/rateLimiter.ts` resolves a key's tier and some tiers are
 * unlimited, so a minted key buys a rate-limit bypass (the G3 control).
 *
 * Guarded now, before the drift is fixed, because the fix would otherwise land
 * on an open door. Operator secret is a HOLDING position for a surface that is
 * broken and has no caller anywhere in the repo — the correct gate when this is
 * actually built is a verified session plus an ownership check binding the
 * caller to `clinicianId`, which does not exist yet.
 */

import type { Express, Request, Response } from 'express';
import { requireInternalSecret } from '../middleware/internalSecret';
import { createApiKeyRequestSchema } from '../services/billing/contracts';
import { generateApiKey, revokeApiKey, getApiKeysByClinicianId } from '../services/billing/apiKeyService';
import { log } from '../obs/logger';

function readValidationMessage(error: { issues?: Array<{ message?: string }> }): string {
  return error.issues?.[0]?.message ?? 'Invalid request payload.';
}

// SubscriptionApiKey.id is a Postgres uuid column — querying it with a
// non-uuid string makes Prisma throw (a 500) instead of returning null.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerApiKeyRoutes(app: Express): void {

  // ── POST /api/api-keys ──────────────────────────────────────────
  app.post('/api/api-keys', requireInternalSecret, async (req: Request, res: Response) => {
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
  app.get('/api/api-keys/:clinicianId', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      const keys = await getApiKeysByClinicianId(req.params.clinicianId);
      res.json(keys);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── DELETE /api/api-keys/:keyId ─────────────────────────────────
  app.delete('/api/api-keys/:keyId', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      if (!UUID_RE.test(req.params.keyId ?? '')) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }
      await revokeApiKey(req.params.keyId);
      res.json({ revoked: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });
}
