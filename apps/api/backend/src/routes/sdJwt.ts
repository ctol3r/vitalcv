/**
 * Wave 199-201 — SD-JWT, Trust Registry Governance, Validation + Schema Routes
 */

import type { Express, Request, Response } from 'express';
import { parseBooleanEnv } from '../utils/environment';
import { isSuperAdminRequest } from '../middleware/tenantGuard';
import { log } from '../obs/logger';
import { issueSdJwt, type SdJwtClaim } from '../services/sd-jwt/sdJwtIssuer';
import { getJwks } from '../services/sd-jwt/keyManager';
import {
  registerIssuer, grantCapability, revokeCapability, appendEvidence,
  checkCapability, listIssuers, getIssuerRecord,
} from '../services/trust-anchors/trustRegistryGovernance';
import { validateSdJwt, validatePresentation } from '../services/verifier/verifierValidation';
import { getSchema, listSchemas, validateAgainstSchema } from '../services/verifier/vc2SchemaRegistry';

function sdJwtEnabled(): boolean {
  return parseBooleanEnv(process.env.FEATURE_SD_JWT_ISSUER, false);
}
function trustAnchorsEnabled(): boolean {
  return parseBooleanEnv(process.env.FEATURE_TRUST_ANCHORS, false);
}

export function registerSdJwtRoutes(app: Express): void {
  // ── JWKS (always available — required for metadata) ─────────────────────────
  app.get('/api/.well-known/jwks.json', async (_req: Request, res: Response) => {
    try {
      const jwks = await getJwks();
      res.status(200).json(jwks);
    } catch (err) {
      res.status(500).json({ error: 'JWKS unavailable' });
    }
  });

  // ── SD-JWT Issuance ─────────────────────────────────────────────────────────
  app.post('/api/credentials/sd-jwt/issue', async (req: Request, res: Response) => {
    if (!sdJwtEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
    const { holderDid, claims, type, expiresInSeconds, issuerDid, kid } = req.body as {
      holderDid?: string;
      claims?: { key: string; value: unknown; disclosed: boolean }[];
      type?: string;
      expiresInSeconds?: number;
      issuerDid?: string;
      kid?: string;
    };

    if (!holderDid || !claims || !Array.isArray(claims)) {
      res.status(400).json({ error: 'holderDid and claims[] are required' });
      return;
    }

    try {
      const issued = await issueSdJwt(holderDid, claims as SdJwtClaim[], {
        type,
        expiresInSeconds,
        issuerDid,
        kid,
      });
      res.status(201).json(issued);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Issuance failed';
      log('error', 'sd_jwt_issue_failed', { error: msg });
      res.status(403).json({ error: msg });
    }
  });

  app.post('/api/credentials/sd-jwt/verify', async (req: Request, res: Response) => {
    if (!sdJwtEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
    const { compact, disclosures, nonce, aud, policy } = req.body as {
      compact?: string; disclosures?: string[]; nonce?: string; aud?: string; policy?: string;
    };
    if (!compact) { res.status(400).json({ error: 'compact is required' }); return; }
    const result = await validateSdJwt(compact, disclosures ?? [], { nonce, expectedAud: aud, policy });
    res.status(result.valid ? 200 : 400).json(result);
  });

  // ── Trust Registry Governance ───────────────────────────────────────────────
  const requireAdmin = (req: Request, res: Response): boolean => {
    if (!req.headers['x-admin-key'] && !isSuperAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return false;
    }
    return true;
  };

  app.get('/api/trust-registry/issuers', (req: Request, res: Response) => {
    if (!trustAnchorsEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
    const { role, hasCapability } = req.query as { role?: string; hasCapability?: string };
    res.status(200).json({ issuers: listIssuers({ role, hasCapability }) });
  });

  app.post('/api/trust-registry/issuers', (req: Request, res: Response) => {
    if (!trustAnchorsEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
    if (!requireAdmin(req, res)) return;
    const { did, name, url, role } = req.body as { did?: string; name?: string; url?: string; role?: string };
    if (!did || !name || !role) { res.status(400).json({ error: 'did, name, role required' }); return; }
    try {
      registerIssuer(did, { name, url, role });
      res.status(201).json({ registered: true, did });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Registration failed' });
    }
  });

  app.post('/api/trust-registry/issuers/:id/capabilities', (req: Request, res: Response) => {
    if (!trustAnchorsEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
    if (!requireAdmin(req, res)) return;
    const { credentialType, grantedBy, origin } = req.body as { credentialType?: string; grantedBy?: string; origin?: 'onchain' | 'offchain' | 'vitalcv' };
    if (!credentialType || !grantedBy) { res.status(400).json({ error: 'credentialType and grantedBy required' }); return; }
    try {
      grantCapability(req.params.id, credentialType, grantedBy, origin);
      res.status(201).json({ granted: true });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Grant failed' });
    }
  });

  app.delete('/api/trust-registry/issuers/:id/capabilities/:type', (req: Request, res: Response) => {
    if (!trustAnchorsEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
    if (!requireAdmin(req, res)) return;
    const { reason } = req.body as { reason?: string };
    try {
      revokeCapability(req.params.id, req.params.type, reason ?? 'no reason given');
      res.status(200).json({ revoked: true });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Revoke failed' });
    }
  });

  app.post('/api/trust-registry/issuers/:id/evidence', (req: Request, res: Response) => {
    if (!trustAnchorsEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
    if (!requireAdmin(req, res)) return;
    const { type, url, checksum, fetchedAt } = req.body as { type?: string; url?: string; checksum?: string; fetchedAt?: string };
    if (!type || !url || !checksum || !fetchedAt) { res.status(400).json({ error: 'type, url, checksum, fetchedAt required' }); return; }
    try {
      appendEvidence(req.params.id, { type, url, checksum, fetchedAt });
      res.status(201).json({ appended: true });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Append failed' });
    }
  });

  app.get('/api/trust-registry/issuers/:id/capabilities', (req: Request, res: Response) => {
    if (!trustAnchorsEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
    const issuer = getIssuerRecord(req.params.id);
    if (!issuer) { res.status(404).json({ error: 'Issuer not found' }); return; }
    res.status(200).json({ capabilities: issuer.capabilities });
  });

  // ── Validation Routes ───────────────────────────────────────────────────────
  app.post('/api/validate/sd-jwt', async (req: Request, res: Response) => {
    const { compact, disclosures, nonce, aud, policy } = req.body as {
      compact?: string; disclosures?: string[]; nonce?: string; aud?: string; policy?: string;
    };
    if (!compact) { res.status(400).json({ error: 'compact is required' }); return; }
    const result = await validateSdJwt(compact, disclosures ?? [], { nonce, expectedAud: aud, policy });
    res.status(result.valid ? 200 : 400).json(result);
  });

  app.post('/api/validate/presentation', async (req: Request, res: Response) => {
    const result = await validatePresentation(req.body);
    res.status(result.valid ? 200 : 400).json(result);
  });

  // ── VC2 Schema Registry ─────────────────────────────────────────────────────
  app.get('/api/schemas', (_req: Request, res: Response) => {
    res.status(200).json({ schemas: listSchemas() });
  });

  app.get('/api/schemas/:type', (req: Request, res: Response) => {
    const schema = getSchema(req.params.type);
    if (!schema) { res.status(404).json({ error: 'Schema not found' }); return; }
    res.status(200).json(schema);
  });

  app.post('/api/schemas/:type/validate', (req: Request, res: Response) => {
    const result = validateAgainstSchema(req.body, req.params.type);
    res.status(result.valid ? 200 : 400).json(result);
  });
}
