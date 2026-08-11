/**
 * decisionCapsules.ts — Wave A (Phase 1 Hardening) + Wave Decision-Capsule
 * Salvaged + upgraded from feature/interoperability-wave65.
 *
 * GET  /api/decisions/:npi                        — list capsules for a clinician
 * GET  /api/decisions/blast-radius/:credentialId  — read-only impact analysis
 * GET  /api/decisions/:capsuleId/detail           — single capsule with dep status
 * GET  /api/decisions/:capsuleId/replay           — cryptographic replay verification ← NEW
 * GET  /api/decisions/export/:npi                 — audit bundle export (all capsules) ← NEW
 * POST /api/decisions                             — create decision capsule
 * POST /api/decisions/cascade/:credentialId       — trigger revocation cascade
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { capsuleEngine, type DecisionType } from '../services/decision/capsuleEngine';
import { revocationCascade } from '../services/decision/revocationCascade';
import { revocationCascadeEngine } from '../services/revocation/cascadeEngine';
import { computeClinicianTrustState, type ClinicianTrustState } from '../services/trust/trustStateEngine';
import prisma from '../graphql/prisma_client';
import { requireVerifiedClerkUserId } from '../middleware/verifiedActor';
import { HttpError } from '../utils/httpError';
import type { DecisionTriggerEvent } from '../../repositories/decisionCapsules.repo';

const VALID_DECISION_TYPES: DecisionType[] = ['HIRING', 'PRIVILEGING', 'DEPLOYMENT', 'RENEWAL'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDecisionType(v: unknown): v is DecisionType {
  return typeof v === 'string' && (VALID_DECISION_TYPES as string[]).includes(v);
}

function isDecisionTriggerEvent(value: unknown): value is DecisionTriggerEvent {
  return value === 'verifier_decision'
    || value === 'start_attestation'
    || value === 'employment_acceptance'
    || value === 'privilege_recommendation';
}

function enrichCapsule<T extends {
  metadata: unknown;
  methodology: string;
}>(capsule: T): T & {
  verifierOrgId: string | null;
  trust_state_snapshot: unknown;
  trust_state_snapshot_v2: unknown;
} {
  const meta = typeof capsule.metadata === 'object' && capsule.metadata !== null
    ? capsule.metadata as Record<string, unknown>
    : null;

  return {
    ...capsule,
    verifierOrgId: typeof meta?.verifierOrgId === 'string'
      ? meta.verifierOrgId
      : typeof meta?.organizationId === 'string'
        ? meta.organizationId
        : typeof meta?.employerId === 'string'
          ? meta.employerId
          : null,
    trust_state_snapshot: meta?.trust_state_snapshot ?? null,
    trust_state_snapshot_v2: meta?.trust_state_snapshot_v2 ?? null,
  };
}

export function registerDecisionCapsuleRoutes(app: Express): void {

  // ── Wave 4: DECISION CAPSULES — QUERY API ────────────────────────────

  app.get('/api/decision-capsules', async (req: Request, res: Response) => {
    const orgId = req.query.org as string | undefined;
    const npi = req.query.npi as string | undefined;

    try {
      if (orgId) {
        if (!UUID_RE.test(orgId)) {
          res.status(400).json({ error: 'orgId must be a valid UUID' });
          return;
        }
        const capsules = await prisma.decisionCapsule.findMany({
          where: { organizationId: orgId },
          orderBy: { decisionTimestamp: 'desc' },
        });
        res.json({ capsules: capsules.map(enrichCapsule) });
      } else if (npi) {
        if (!/^\d{10}$/.test(npi)) {
          res.status(400).json({ error: 'npi must be a 10-digit string' });
          return;
        }
        const capsules = await prisma.decisionCapsule.findMany({
          where: { subjectNpi: npi },
          orderBy: { decisionTimestamp: 'desc' },
        });
        res.json({ capsules: capsules.map(enrichCapsule) });
      } else {
        res.status(400).json({ error: 'Must provide org or npi query parameter' });
      }
    } catch (err) {
      log('error', 'decision_capsules: query failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to query decision capsules' });
    }
  });

  app.get('/api/decision-capsules/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'id must be a valid UUID' });
      return;
    }
    try {
      const capsule = await prisma.decisionCapsule.findUnique({ where: { id } });
      if (!capsule) {
        res.status(404).json({ error: 'Decision capsule not found' });
        return;
      }
      res.json(enrichCapsule(capsule));
    } catch (err) {
      log('error', 'decision_capsules: get by id failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to retrieve decision capsule' });
    }
  });

  app.get('/api/decision-capsules/:id/current-state', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'id must be a valid UUID' });
      return;
    }
    try {
      const capsule = await prisma.decisionCapsule.findUnique({ where: { id } });
      if (!capsule) {
        res.status(404).json({ error: 'Decision capsule not found' });
        return;
      }
      
      const currentTrustState = await computeClinicianTrustState(capsule.subjectNpi);
      const meta = capsule.metadata as Record<string, unknown> | null;
      const snapshotAtDecision = meta?.trust_state_snapshot as ClinicianTrustState | undefined;
      const scoreAtDecision = snapshotAtDecision?.readiness_score ?? null;
      const currentScore = currentTrustState.readiness_score;
      const scoreDelta = scoreAtDecision !== null ? currentScore - scoreAtDecision : null;
      
      res.json({
        capsuleId: capsule.id,
        currentStatus: capsule.status,
        impactedByRevocation: capsule.impactedByRevocation,
        trustStateAtDecision: snapshotAtDecision,
        currentTrustState,
        scoreDelta,
        trustDegraded: scoreDelta !== null && scoreDelta < -10,
      });
    } catch (err) {
      log('error', 'decision_capsules: current-state failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to compute current state' });
    }
  });

  // ── GET /api/employer/decisions ───────────────────────────────────────
  // Returns recent Decision Capsules for the verifier's org (via accepted applications)
  app.get('/api/employer/decisions', async (req: Request, res: Response) => {
    /*
     * S1 — this route resolves the caller's ORGANISATION from their identity and
     * then answers with that org's decision capsules, so identity here IS the
     * tenancy boundary. It used to read `x-clerk-user-id` straight off the
     * request: a plain header on a public origin, meaning anyone holding a known
     * member's Clerk id could read that employer's hiring decisions. Identity
     * now comes from the verified session token only — `verifiedAuth` is
     * populated in shadow as well as enforce, so this fails closed today rather
     * than at some future flip.
     */
    let clerkUserId: string;
    try {
      clerkUserId = requireVerifiedClerkUserId(req);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 401;
      res.status(status).json({ error: 'Verified Clerk session required.' });
      return;
    }
    try {
      // Find the verifier's org
      const user = await prisma.user.findUnique({ where: { clerkUserId } });
      if (!user?.organizationId) {
        res.json({ capsules: [], totalCount: 0 });
        return;
      }
      // Get accepted applications for this org to find NPIs
      const acceptedApps = await (prisma as any).application.findMany({
        where: {
          status: 'ACCEPTED',
          opportunity: { organizationId: user.organizationId },
          npi: { not: null },
        },
        select: { npi: true },
        distinct: ['npi'],
        take: 50,
      });
      const npis = acceptedApps.map((a: any) => a.npi as string).filter(Boolean);
      if (npis.length === 0) {
        res.json({ capsules: [], totalCount: 0 });
        return;
      }
      // Fetch capsules for all these NPIs
      const capsules = await prisma.decisionCapsule.findMany({
        where: { subjectNpi: { in: npis } },
        orderBy: { decisionTimestamp: 'desc' },
        take: 20,
      });
      const enriched = capsules.map((c) => enrichCapsule({
        id: c.id,
        subjectNpi: c.subjectNpi,
        subjectDid: c.subjectDid,
        decisionType: c.decisionType,
        decisionTimestamp: c.decisionTimestamp.toISOString(),
        status: c.status,
        credentialIds: c.credentialIds,
        issuerIds: c.issuerIds,
        artifactHash: c.artifactHash,
        methodology: c.methodology,
        metadata: c.metadata,
        createdAt: c.createdAt.toISOString(),
      }));
      res.json({ capsules: enriched, totalCount: enriched.length });
    } catch (err) {
      log('error', 'decision_capsules: employer_decisions failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to retrieve employer decisions' });
    }
  });

  // ── GET /api/decisions/impact/:npi ────────────────────────────────────
  // Must be defined BEFORE /:npi to avoid route conflict
  app.get('/api/decisions/impact/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !/^\d{10}$/.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI — expected 10 digits' });
      return;
    }
    try {
      // Fetch all capsules and current trust state in parallel
      const [capsules, currentTrustState] = await Promise.all([
        capsuleEngine.getCapsulesByNpi(npi),
        computeClinicianTrustState(npi),
      ]);

      // For each capsule, compare trust state at decision time vs now
      const capsuleImpacts = capsules.map((capsule) => {
        const meta = capsule.metadata as Record<string, unknown> | null;
        const snapshotAtDecision = meta?.trust_state_snapshot as ClinicianTrustState | undefined;
        const scoreAtDecision = snapshotAtDecision?.readiness_score ?? null;
        const bandAtDecision = snapshotAtDecision?.readiness_level ?? null;
        const currentScore = currentTrustState.readiness_score;
        const currentBand = currentTrustState.readiness_level;

        // Determine risk: capsule is AT_RISK if current score degraded significantly
        const scoreDelta = scoreAtDecision !== null ? currentScore - scoreAtDecision : null;
        const trustDegraded = scoreDelta !== null && scoreDelta < -10;
        const atRisk = capsule.status === 'VALID' && trustDegraded;

        return {
          capsuleId: capsule.id,
          decisionType: capsule.decisionType,
          decisionTimestamp: capsule.decisionTimestamp,
          currentStatus: capsule.status,
          projectedStatus: atRisk ? 'AT_RISK' : capsule.status,
          trustBandAtDecision: bandAtDecision,
          trustScoreAtDecision: scoreAtDecision,
          currentTrustBand: currentBand,
          currentTrustScore: currentScore,
          scoreDelta,
          trustDegraded,
          credentialCount: capsule.credentialIds.length,
        };
      });

      const atRiskCount = capsuleImpacts.filter((c) => c.projectedStatus === 'AT_RISK').length;

      log('info', 'decision_capsules: impact computed', {
        npi: npi.slice(0, 4) + '****',
        capsuleCount: capsules.length,
        atRiskCount,
        currentBand: currentTrustState.readiness_level,
      });

      res.json({
        npi,
        currentTrustState: {
          readiness_level: currentTrustState.readiness_level,
          readiness_score: currentTrustState.readiness_score,
          readiness_status: currentTrustState.readiness_status,
          gap_summary: currentTrustState.gap_summary,
          methodology_version: currentTrustState.methodology_version,
          computed_at: currentTrustState.computed_at,
        },
        capsuleCount: capsules.length,
        atRiskCount,
        capsuleImpacts,
      });
    } catch (err) {
      log('error', 'decision_capsules: impact failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to compute decision impact' });
    }
  });

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
      // Enrich each capsule with trust_state_snapshot from metadata (Wave 244)
      const enrichedCapsules = capsules.map((capsule) => enrichCapsule(capsule));
      res.json({ npi, capsules: enrichedCapsules, totalCount: capsules.length, statusCounts });
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
      res.json(enrichCapsule(capsule));
    } catch (err) {
      log('error', 'decision_capsules: detail failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to retrieve decision capsule' });
    }
  });

  // ── POST /api/decisions ───────────────────────────────────────────────
  app.post('/api/decisions', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const subjectNpi = typeof body.subjectNpi === 'string' ? body.subjectNpi.trim() : '';
    const subjectDid = typeof body.subjectDid === 'string' && body.subjectDid.trim().length > 0
      ? body.subjectDid.trim()
      : (subjectNpi ? `did:vitalcv:${subjectNpi}` : '');
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
    const verifierOrgId = typeof body.verifierOrgId === 'string' ? body.verifierOrgId.trim() : undefined;
    const triggerEventCandidate = body.triggerEvent ?? metadata?.triggerEvent;
    const triggerEvent = isDecisionTriggerEvent(triggerEventCandidate)
      ? triggerEventCandidate
      : undefined;
    const sourceReferenceId = typeof body.sourceReferenceId === 'string'
      ? body.sourceReferenceId.trim()
      : typeof metadata?.sourceReferenceId === 'string'
        ? metadata.sourceReferenceId.trim()
        : undefined;

    if (!subjectNpi || !/^\d{10}$/.test(subjectNpi)) {
      res.status(400).json({ error: 'Invalid subjectNpi — expected 10 digits' });
      return;
    }
    if (!isValidDecisionType(decisionType)) {
      res.status(400).json({ error: `decisionType must be one of: ${VALID_DECISION_TYPES.join(', ')}` });
      return;
    }
    try {
      const capsule = await capsuleEngine.createDecisionCapsule({
        subjectDid,
        subjectNpi,
        decisionType,
        credentialIds,
        issuerIds,
        verifierOrgId,
        metadata,
        triggerEvent,
        sourceReferenceId,
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

  // ── GET /api/decisions/:capsuleId/replay ─────────────────────────────
  // Cryptographic replay verification: recomputes artifactHash from stored
  // decision_capsule_payload and compares against the persisted hash.
  // Returns { valid: true } if the capsule is unmodified and reproducible.
  app.get('/api/decisions/:capsuleId/replay', async (req: Request, res: Response) => {
    const { capsuleId } = req.params;
    if (!capsuleId || !UUID_RE.test(capsuleId)) {
      res.status(400).json({ error: 'capsuleId must be a valid UUID' });
      return;
    }
    try {
      const result = await capsuleEngine.verifyDecisionCapsuleReplay(capsuleId);
      log('info', 'decision_capsules: replay_verified', {
        capsuleId: capsuleId.slice(0, 8) + '…',
        valid: result.valid,
      });
      res.status(result.valid ? 200 : 409).json({
        ...result,
        verifiedAt: new Date().toISOString(),
        message: result.valid
          ? 'Capsule is cryptographically intact and reproducible.'
          : 'Capsule hash mismatch — possible tampering or data corruption.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
        return;
      }
      log('error', 'decision_capsules: replay_failed', { capsuleId, error: message });
      res.status(500).json({ error: 'Replay verification failed' });
    }
  });

  // ── GET /api/decisions/export/:npi ───────────────────────────────────
  // Audit bundle export: all decision capsules for an NPI as a signed
  // JSON bundle suitable for Joint Commission / CMS compliance audits.
  // Optional: ?format=json (default) or ?format=ndjson
  app.get('/api/decisions/export/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const NPI_RE = /^\d{10}$/;
    if (!npi || !NPI_RE.test(npi)) {
      res.status(400).json({ error: 'npi must be a 10-digit string' });
      return;
    }
    try {
      const capsules = await capsuleEngine.getCapsulesByNpi(npi);
      const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : 'json';

      // Compute a bundle-level hash for integrity verification
      const { sha256ForPayload } = await import('../utils/deterministic');
      const bundleHash = sha256ForPayload({
        npi,
        capsuleCount: capsules.length,
        capsuleIds: capsules.map((c) => c.id).sort(),
        exportedAt: new Date().toISOString(),
      });

      const bundle = {
        '@context': 'https://vitalcv.com/schema/decision-capsule-bundle/v1',
        '@type': 'DecisionCapsuleBundle',
        subject: { npi },
        exportedAt: new Date().toISOString(),
        capsuleCount: capsules.length,
        bundleHash,
        issuer: 'VitalCV',
        methodology: 'decision_capsule.v262',
        capsules: capsules.map((c) => ({
          id: c.id,
          decisionType: c.decisionType,
          decisionAction: c.decisionAction,
          decisionTimestamp: c.decisionTimestamp,
          status: c.status,
          subjectDid: c.subjectDid,
          subjectNpi: c.subjectNpi,
          credentialIds: c.credentialIds,
          issuerIds: c.issuerIds,
          artifactHash: c.artifactHash,
          trustStateHash: c.trustStateHash,
          methodology: c.methodology,
          verifierOrgId: c.verifierOrgId,
        })),
      };

      if (format === 'ndjson') {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="capsule-bundle-${npi}.ndjson"`,
        );
        for (const capsule of bundle.capsules) {
          res.write(JSON.stringify(capsule) + '\n');
        }
        res.end();
        return;
      }

      res.setHeader('Content-Disposition', `attachment; filename="capsule-bundle-${npi}.json"`);
      log('info', 'decision_capsules: bundle_exported', { npi, capsuleCount: capsules.length });
      res.json(bundle);
    } catch (err) {
      log('error', 'decision_capsules: export_failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Failed to export capsule bundle' });
    }
  });
}
