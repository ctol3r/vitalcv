/**
 * decisionCapsules.ts — Wave A (Phase 1 Hardening)
 * Salvaged + upgraded from feature/interoperability-wave65.
 *
 * GET  /api/decisions/:npi                      — list capsules for a clinician
 * GET  /api/decisions/blast-radius/:credentialId — read-only impact analysis
 * GET  /api/decisions/:capsuleId/detail          — single capsule with dep status
 * POST /api/decisions                            — create decision capsule
 * POST /api/decisions/cascade/:credentialId      — trigger revocation cascade
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { capsuleEngine, type DecisionType } from '../services/decision/capsuleEngine';
import { revocationCascade } from '../services/decision/revocationCascade';
import { revocationCascadeEngine } from '../services/revocation/cascadeEngine';

const VALID_DECISION_TYPES: DecisionType[] = ['HIRING', 'PRIVILEGING', 'DEPLOYMENT', 'RENEWAL'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDecisionType(v: unknown): v is DecisionType {
  return typeof v === 'string' && (VALID_DECISION_TYPES as string[]).includes(v);
}

export function registerDecisionCapsuleRoutes(app: Express): void {

  // ── GET /api/decisions/:npi ────────────────────────────────────────────
  app.get('/api/decisions/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !/^\d{10}$/.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI — expected 10 digits' });
      return;
    }
    try {
      const capsules = await capsuleEngine.getCapsulesByNpi(npi);
      const statusCounts = { VALID: 0, AT_RISK: 0, INVALID: 0 };
      for (const c of capsules) {
        if (c.status in statusCounts) statusCounts[c.status as keyof typeof statusCounts]++;
      }
      res.json({ npi, capsules, totalCount: capsules.length, statusCounts });
    } catch (err) {
      log('error', 'decision_capsules: list failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to retrieve decision capsules' });
    }
  });

  // ── GET /api/decisions/blast-radius/:credentialId ─────────────────────
  // Must be defined BEFORE /:capsuleId/detail to avoid route conflict
  app.get('/api/decisions/blast-radius/:credentialId', async (req: Request, res: Response) => {
    const { credentialId } = req.params;
    if (!credentialId || !UUID_RE.test(credentialId)) {
      res.status(400).json({ error: 'credentialId must be a valid UUID' });
      return;
    }
    try {
      // Light blast radius (capsule-level)
      const basic = await revocationCascade.computeBlastRadius(credentialId);

      // Deep report (employer/deployment impact) — best effort, non-fatal
      let deepReport = null;
      try {
        const scope = await revocationCascadeEngine.resolveCredentialScope(credentialId);
        deepReport = await revocationCascadeEngine.generateRevocationCascadeReport(scope);
      } catch { /* credential may not exist yet in staging */ }

      log('info', 'decision_capsules: blast radius computed', {
        credentialId: credentialId.slice(0, 8) + '…',
        totalImpacted: basic.totalImpacted,
      });

      res.json({ ...basic, deepReport });
    } catch (err) {
      log('error', 'decision_capsules: blast radius failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to compute blast radius' });
    }
  });

  // ── GET /api/decisions/:capsuleId/detail ─────────────────────────────
  app.get('/api/decisions/:capsuleId/detail', async (req: Request, res: Response) => {
    const { capsuleId } = req.params;
    if (!capsuleId || !UUID_RE.test(capsuleId)) {
      res.status(400).json({ error: 'capsuleId must be a valid UUID' });
      return;
    }
    try {
      const capsule = await capsuleEngine.getCapsuleById(capsuleId);
      if (!capsule) {
        res.status(404).json({ error: 'Decision capsule not found' });
        return;
      }
      res.json(capsule);
    } catch (err) {
      log('error', 'decision_capsules: detail failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to retrieve decision capsule' });
    }
  });

  // ── POST /api/decisions ───────────────────────────────────────────────
  app.post('/api/decisions', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const subjectDid = typeof body.subjectDid === 'string' ? body.subjectDid.trim() : '';
    const subjectNpi = typeof body.subjectNpi === 'string' ? body.subjectNpi.trim() : '';
    const decisionType = body.decisionType;
    const credentialIds = Array.isArray(body.credentialIds)
      ? body.credentialIds.filter((id): id is string => typeof id === 'string')
      : [];
    const issuerIds = Array.isArray(body.issuerIds)
      ? body.issuerIds.filter((id): id is string => typeof id === 'string')
      : [];
    const metadata = typeof body.metadata === 'object' && body.metadata !== null
      ? body.metadata as Record<string, unknown>
      : undefined;

    if (!subjectNpi || !/^\d{10}$/.test(subjectNpi)) {
      res.status(400).json({ error: 'Invalid subjectNpi — expected 10 digits' });
      return;
    }
    if (!subjectDid) {
      res.status(400).json({ error: 'subjectDid is required' });
      return;
    }
    if (!isValidDecisionType(decisionType)) {
      res.status(400).json({ error: `decisionType must be one of: ${VALID_DECISION_TYPES.join(', ')}` });
      return;
    }
    if (credentialIds.length === 0) {
      res.status(400).json({ error: 'At least one credentialId is required' });
      return;
    }

    try {
      const capsule = await capsuleEngine.createDecisionCapsule({
        subjectDid, subjectNpi, decisionType, credentialIds, issuerIds, metadata,
      });
      res.status(201).json(capsule);
    } catch (err) {
      log('error', 'decision_capsules: create failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to create decision capsule' });
    }
  });

  // ── POST /api/decisions/cascade/:credentialId ────────────────────────
  app.post('/api/decisions/cascade/:credentialId', async (req: Request, res: Response) => {
    const { credentialId } = req.params;
    if (!credentialId || !UUID_RE.test(credentialId)) {
      res.status(400).json({ error: 'credentialId must be a valid UUID' });
      return;
    }
    try {
      const result = await revocationCascade.propagateRevocation(credentialId);
      log('info', 'decision_capsules: cascade complete', {
        credentialId: credentialId.slice(0, 8) + '…',
        totalAffected: result.totalAffected,
      });
      res.json(result);
    } catch (err) {
      log('error', 'decision_capsules: cascade failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to propagate revocation cascade' });
    }
  });
}
