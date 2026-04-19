/**
 * auditDecision.ts — Acceptance Graph & Decision Learning (Wave)
 *
 * POST /api/audit/decision
 *   Captures an employer's decision on a clinician's packet.
 *   Side-effects (must both succeed or the endpoint reports failure):
 *     1. Append a standard AuditEvent row (durable audit log).
 *     2. Create a DecisionLearningCapsule with the exact passport snapshot
 *        at decision time — this is the training signal for the
 *        Predictive Acceptance engine.
 *
 * This endpoint is purely additive; it does not mutate the Application row
 * or the cryptographic DecisionCapsule — those are owned by their own
 * routes (employerActions.ts, decisionCapsules.ts).
 */

import type { Express, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import prisma from '../graphql/prisma_client';
import { appendAuditEvent } from '../services/audit/auditLedger';
import { log } from '../obs/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const VALID_OUTCOMES = [
  'ACCEPTED_HEAD_START',
  'REQUESTED_INFO',
  'ROUTED_MANUAL',
  'REJECTED',
] as const;
export type DecisionOutcome = (typeof VALID_OUTCOMES)[number];

function isDecisionOutcome(v: unknown): v is DecisionOutcome {
  return typeof v === 'string' && (VALID_OUTCOMES as readonly string[]).includes(v);
}

function sha256OfJson(value: unknown): string {
  const canonical = JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export function registerAuditDecisionRoutes(app: Express): void {
  app.post('/api/audit/decision', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const clinicianId = typeof body.clinicianId === 'string' ? body.clinicianId.trim() : '';
    const employerId = typeof body.employerId === 'string' ? body.employerId.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const decisionOutcome = body.decisionOutcome;
    const timeToDecisionRaw = typeof body.timeToDecision === 'number' ? body.timeToDecision : Number.NaN;
    const timeToDecision = Number.isFinite(timeToDecisionRaw) ? Math.max(0, Math.round(timeToDecisionRaw)) : null;
    const passportSnapshot = typeof body.passportSnapshot === 'object' && body.passportSnapshot !== null
      ? (body.passportSnapshot as Record<string, unknown>)
      : null;

    // ── Validate ─────────────────────────────────────────────────────
    if (!UUID_RE.test(clinicianId)) {
      res.status(400).json({ error: 'clinicianId must be a valid UUID' });
      return;
    }
    if (!UUID_RE.test(employerId)) {
      res.status(400).json({ error: 'employerId must be a valid UUID' });
      return;
    }
    if (!role) {
      res.status(400).json({ error: 'role is required' });
      return;
    }
    if (!isDecisionOutcome(decisionOutcome)) {
      res.status(400).json({
        error: `decisionOutcome must be one of: ${VALID_OUTCOMES.join(', ')}`,
      });
      return;
    }
    if (timeToDecision === null) {
      res.status(400).json({ error: 'timeToDecision (seconds) is required and must be a finite number' });
      return;
    }
    if (!passportSnapshot) {
      res.status(400).json({ error: 'passportSnapshot is required and must be an object' });
      return;
    }

    const snapshotHash = sha256OfJson(passportSnapshot);

    try {
      // 1. Durable AuditEvent row — the "standard AuditLog" per spec
      const auditEvent = await prisma.auditEvent.create({
        data: {
          type: 'DECISION_TAKEN',
          hash: snapshotHash,
          referenceId: clinicianId,
          clinicianId,
          organizationId: employerId,
          actorId: employerId,
          metadata: {
            role,
            decisionOutcome,
            timeToDecision,
            source: 'employer_review_dashboard',
          },
        },
      });

      // 2. In-memory SIEM ledger (best-effort, in-process only)
      appendAuditEvent({
        category: 'DECISION',
        actor: employerId,
        resource: clinicianId,
        requestFields: { role, decisionOutcome, timeToDecision },
        resultFields: { passportSnapshotHash: snapshotHash, auditEventId: auditEvent.id },
        severity: 'INFO',
      });

      // 3. Persist the learning capsule — the training signal
      const capsule = await prisma.decisionLearningCapsule.create({
        data: {
          clinicianId,
          employerId,
          role,
          passportSnapshot: passportSnapshot as object,
          decisionOutcome,
          timeToDecision,
        },
      });

      log('info', 'audit_decision: capsule_recorded', {
        capsuleId: capsule.id,
        auditEventId: auditEvent.id,
        decisionOutcome,
        employerId: employerId.slice(0, 8) + '…',
        role,
        timeToDecision,
      });

      res.status(201).json({
        capsuleId: capsule.id,
        auditEventId: auditEvent.id,
        decisionOutcome,
        passportSnapshotHash: snapshotHash,
        recordedAt: capsule.timestamp.toISOString(),
      });
    } catch (err) {
      log('error', 'audit_decision: failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to record decision' });
    }
  });
}
