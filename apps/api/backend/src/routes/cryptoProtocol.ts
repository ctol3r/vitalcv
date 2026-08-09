/**
 * cryptoProtocol.ts — PQC Crypto API
 *
 * GET  /api/crypto/suites                 — list all available crypto suites
 * GET  /api/crypto/keys                   — public key registry (no secrets)
 * POST /api/crypto/sign/artifact/:id      — sign a VerificationArtifact
 * POST /api/crypto/sign/capsule/:id       — sign a DecisionCapsule
 * GET  /api/crypto/verify/artifact/:id    — verify artifact signature
 * GET  /api/crypto/verify/capsule/:id     — verify capsule signature
 * POST /api/crypto/resign/artifact/:id    — resign artifact with a new suite
 * POST /api/crypto/resign/capsule/:id     — resign capsule with a new suite
 * POST /api/crypto/batch-resign           — resign all artifacts for an NPI
 * GET  /api/crypto/status/:npi            — PQC readiness summary for an NPI
 */

import type { Express, Request, Response } from 'express';
import {
  SUITE_REGISTRY,
  keyStore,
  type SuiteId,
} from '../services/crypto/cryptoRegistry';
import {
  signArtifact,
  signCapsule,
  verifyArtifactSignature,
  verifyCapsuleSignature,
  batchResignArtifacts,
  getNpiCryptoStatus,
} from '../services/crypto/artifactCryptoService';
import { requireInternalSecret } from '../middleware/internalSecret';
import { log } from '../obs/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NPI_RE  = /^\d{10}$/;

const VALID_SUITES: SuiteId[] = ['ed25519', 'ml-dsa-65', 'slh-dsa-128s'];

function parseSuite(raw: unknown, def: SuiteId = 'ml-dsa-65'): SuiteId {
  return VALID_SUITES.includes(raw as SuiteId) ? (raw as SuiteId) : def;
}

/**
 * AUTHORIZATION (2026-08-08). The sign/resign routes below had NO
 * authorization. They sit behind the global tenant guard, which accepted the
 * mere PRESENCE of a caller-supplied `x-org-id`, and none of them reads the
 * org — so one header reached all five. These are not reads that leak; they
 * are PERSISTENT WRITES to trust-bearing data: `signArtifact` updates
 * `VerificationArtifact.rawPayload` with a new crypto envelope and appends to
 * `_cryptoHistory`.
 *
 * `batch-resign` is the worst of them. It takes an NPI — a public identifier —
 * and re-signs up to 2000 of that clinician's artifacts in one call. An
 * anonymous caller could rewrite the signature envelope on a named clinician's
 * entire evidence set.
 *
 * Operator secret: signing is a system operation, and no caller for these paths
 * exists anywhere in the repo.
 */
export function registerCryptoProtocolRoutes(app: Express): void {

  /**
   * GET /api/crypto/suites
   * All available crypto suites with metadata.
   */
  app.get('/api/crypto/suites', (_req: Request, res: Response) => {
    const suites = Object.values(SUITE_REGISTRY);
    const activePQC = suites.filter(s => s.quantumResistant && s.status === 'ACTIVE');
    res.json({
      schema:     'https://vitalcv.com/crypto/v1',
      totalSuites: suites.length,
      pqcSuites:  activePQC.length,
      recommended: 'ml-dsa-65',
      archival:    'slh-dsa-128s',
      suites,
    });
  });

  /**
   * GET /api/crypto/keys
   * Public key registry — public keys only, no secrets.
   */
  app.get('/api/crypto/keys', (_req: Request, res: Response) => {
    const keys = keyStore.listPublic();
    res.json({
      schema: 'https://vitalcv.com/crypto/v1',
      total:  keys.length,
      keys,
      note:   'Public keys only. Private keys never exposed via API.',
    });
  });

  /**
   * POST /api/crypto/sign/artifact/:id
   * Sign a VerificationArtifact.
   * Body: { suite?: 'ed25519'|'ml-dsa-65'|'slh-dsa-128s' }
   */
  app.post('/api/crypto/sign/artifact/:id', requireInternalSecret, async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid artifact ID' }); return; }

    const suite = parseSuite((req.body as Record<string, unknown>)?.suite);
    try {
      const result = await signArtifact(id, suite);
      res.status(201).json({
        ...result,
        suiteInfo: SUITE_REGISTRY[suite],
        verifyUrl: `/api/crypto/verify/artifact/${id}`,
      });
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      log('error', 'crypto: sign/artifact failed', { id, suite, error: msg });
      res.status(500).json({ error: 'Signing failed', detail: msg });
    }
  });

  /**
   * POST /api/crypto/sign/capsule/:id
   * Sign a DecisionCapsule.
   * Body: { suite?: 'ed25519'|'ml-dsa-65'|'slh-dsa-128s' }
   */
  app.post('/api/crypto/sign/capsule/:id', requireInternalSecret, async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid capsule ID' }); return; }

    const suite = parseSuite((req.body as Record<string, unknown>)?.suite);
    try {
      const result = await signCapsule(id, suite);
      res.status(201).json({
        ...result,
        suiteInfo: SUITE_REGISTRY[suite],
        verifyUrl: `/api/crypto/verify/capsule/${id}`,
      });
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      log('error', 'crypto: sign/capsule failed', { id, suite, error: msg });
      res.status(500).json({ error: 'Signing failed', detail: msg });
    }
  });

  /**
   * GET /api/crypto/verify/artifact/:id
   * Verify the PQC signature on a VerificationArtifact.
   */
  app.get('/api/crypto/verify/artifact/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid artifact ID' }); return; }

    try {
      const result = await verifyArtifactSignature(id);
      const status = !result.signaturePresent ? 204
        : result.signatureValid ? 200 : 409;

      res.status(status === 204 ? 200 : status).json({
        ...result,
        message: !result.signaturePresent ? 'No signature — artifact uses hash-only baseline'
          : result.signatureValid ? `Signature valid (${result.suiteId})`
          : `Signature INVALID — possible tampering`,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      res.status(500).json({ error: 'Verification failed', detail: msg });
    }
  });

  /**
   * GET /api/crypto/verify/capsule/:id
   * Verify the PQC signature on a DecisionCapsule.
   */
  app.get('/api/crypto/verify/capsule/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid capsule ID' }); return; }

    try {
      const result = await verifyCapsuleSignature(id);
      res.status(result.signatureValid || !result.signaturePresent ? 200 : 409).json({
        ...result,
        message: !result.signaturePresent ? 'No PQC signature — uses SHA-256 hash baseline'
          : result.signatureValid ? `Signature valid (${result.suiteId})`
          : 'Signature INVALID',
        verifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      res.status(500).json({ error: 'Verification failed', detail: msg });
    }
  });

  /**
   * POST /api/crypto/resign/artifact/:id
   * Resign an artifact with a new (or upgraded) suite.
   * Preserves previous signature in _cryptoHistory[].
   * Body: { suite: 'ml-dsa-65'|'slh-dsa-128s'|'ed25519' }
   */
  app.post('/api/crypto/resign/artifact/:id', requireInternalSecret, async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid artifact ID' }); return; }

    const suite = parseSuite((req.body as Record<string, unknown>)?.suite);
    try {
      const result = await signArtifact(id, suite);
      res.json({
        ...result,
        action: 'RESIGNED',
        suiteInfo: SUITE_REGISTRY[suite],
        message: `Artifact resigned with ${suite}. Previous signature preserved in _cryptoHistory.`,
      });
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      log('error', 'crypto: resign/artifact failed', { id, suite, error: msg });
      res.status(500).json({ error: 'Resign failed', detail: msg });
    }
  });

  /**
   * POST /api/crypto/resign/capsule/:id
   * Resign a DecisionCapsule.
   * Body: { suite }
   */
  app.post('/api/crypto/resign/capsule/:id', requireInternalSecret, async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid capsule ID' }); return; }

    const suite = parseSuite((req.body as Record<string, unknown>)?.suite);
    try {
      const result = await signCapsule(id, suite);
      res.json({
        ...result,
        action: 'RESIGNED',
        suiteInfo: SUITE_REGISTRY[suite],
        message: `Capsule resigned with ${suite}.`,
      });
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      log('error', 'crypto: resign/capsule failed', { id, suite, error: msg });
      res.status(500).json({ error: 'Resign failed', detail: msg });
    }
  });

  /**
   * POST /api/crypto/batch-resign
   * Resign all active artifacts for an NPI with a target suite.
   *
   * Body: {
   *   npi:           string   required
   *   suite?:        string   default: ml-dsa-65
   *   skipAlreadySigned?: boolean  default: false
   *   limit?:        number   max artifacts per call, default 500
   * }
   */
  app.post('/api/crypto/batch-resign', requireInternalSecret, async (req: Request, res: Response) => {
    const body  = req.body as Record<string, unknown>;
    const npi   = typeof body.npi === 'string' ? body.npi.trim() : '';
    if (!NPI_RE.test(npi)) { res.status(400).json({ error: 'Valid 10-digit NPI required' }); return; }

    const suite             = parseSuite(body.suite);
    const skipAlreadySigned = body.skipAlreadySigned === true;
    const limit             = Math.min(Number(body.limit ?? 500), 2000);

    try {
      const report = await batchResignArtifacts(npi, suite, { skipAlreadySigned, limit });
      res.json({
        ...report,
        suiteInfo: SUITE_REGISTRY[suite],
        statusUrl: `/api/crypto/status/${npi}`,
        message:   `${report.signedCount} artifacts signed with ${suite}. ${report.failedCount} failed.`,
      });
    } catch (err) {
      log('error', 'crypto: batch-resign failed', { npi, suite, error: String(err) });
      res.status(500).json({ error: 'Batch resign failed' });
    }
  });

  /**
   * GET /api/crypto/status/:npi
   * PQC readiness summary for a clinician.
   * Shows how many artifacts are PQC-signed vs classically-signed vs unsigned.
   */
  app.get('/api/crypto/status/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params;
    try {
      const status = await getNpiCryptoStatus(npi);
      res.json({
        ...status,
        availableSuites: SUITE_REGISTRY,
        batchResignUrl: '/api/crypto/batch-resign',
      });
    } catch (err) {
      log('error', 'crypto: status failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Status check failed' });
    }
  });
}
