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
import { computeClinicianTrustState, type ClinicianTrustState } from '../services/trust/trustStateEngine';
import prisma from '../graphql/prisma_client';

const VALID_DECISION_TYPES: DecisionType[] = ['HIRING', 'PRIVILEGING', 'DEPLOYMENT', 'RENEWAL'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDecisionType(v: unknown): v is DecisionType {
  return typeof v === 'string' && (VALID_DECISION_TYPES as string[]).includes(v);
}

export function registerDecisionCapsuleRoutes(app: Express): void {

  // ── GET /api/employer/decisions ───────────────────────────────────────
  // Returns recent Decision Capsules for the verifier's org (via accepted applications)
  app.get('/api/employer/decisions', async (req: Request, res: Response) => {
    const clerkUserId = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
    if (!clerkUserId) {
      res.status(401).json({ error: 'Missing x-clerk-user-id header' });
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
      const acceptedApps = await prisma.application.findMany({
        where: {
          status: 'ACCEPTED',
          opportunity: { organizationId: user.organizationId },
          npi: { not: null },
        },
        select: { npi: true },
        distinct: ['npi'],
        take: 50,
      });
      const npis = acceptedApps.map((a) => a.npi as string).filter(Boolean);
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
      const enriched = capsules.map((c) => {
        const meta = c.metadata as Record<string, unknown> | null;
        return {
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
          trust_state_snapshot: meta?.trust_state_snapshot ?? null,
          metadata: c.metadata,
          createdAt: c.createdAt.toISOString(),
        };
      });
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
      const enrichedCapsules = capsules.map((capsule) => {
        const meta = capsule.metadata as Record<string, unknown> | null;
        return {
          ...capsule,
          trust_state_snapshot: meta?.trust_state_snapshot ?? null,
        };
      });
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
