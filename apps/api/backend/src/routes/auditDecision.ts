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

/**
 * Canonical JSON — stable string form that sorts object keys at every
 * depth. Arrays preserve order. Required so the SHA-256 snapshot hash is
 * invariant under key reordering and faithfully reflects the *entire*
 * nested payload. (A previous implementation passed a top-level key list
 * as `JSON.stringify`'s replacer, which silently stripped nested fields
 * and caused distinct snapshots to collide on the same hash.)
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k]));
  return '{' + entries.join(',') + '}';
}

function sha256OfJson(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

/**
 * Returns the Clerk user id from the `x-clerk-user-id` header. The web
 * proxy attaches this header from `auth().userId` on every authenticated
 * request; an empty/missing value means the caller is unauthenticated.
 * `/api/audit/decision` writes to the non-repudiable audit chain — every
 * row must carry a real actor identity, never an organization id alone.
 */
function readActorId(req: Request): string | null {
  const raw = req.headers['x-clerk-user-id'];
  const v = typeof raw === 'string' ? raw.trim() : '';
  return v.length > 0 ? v : null;
}

export function registerAuditDecisionRoutes(app: Express): void {
  app.post('/api/audit/decision', async (req: Request, res: Response) => {
    // Audit-chain integrity contract: a decision row without an
    // attributable individual actor is unverifiable on replay. Reject
    // anonymous writes BEFORE any DB mutation.
    const actorId = readActorId(req);
    if (!actorId) {
      res.status(401).json({
        error: 'unauthenticated',
        detail: 'x-clerk-user-id header required; audit-decision writes the non-repudiable audit chain.',
      });
      return;
    }

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
      // Both DB side-effects must land atomically. A prior version created
      // them sequentially, so a failure on the capsule insert could leave
      // the endpoint returning 500 with a persisted audit row — violating
      // the "both succeed" contract and producing duplicate / contradictory
      // history on client retries. `$transaction` guarantees all-or-nothing.
      //
      // AuditEvent has no dedicated actor column; organizationId already
      // carries the employer id, and the Clerk user id of the individual
      // operator is mirrored into metadata.actorId so downstream
      // consumers can attribute the decision to a named person, not
      // just the org. Before this change the field carried employerId
      // verbatim, which collapsed person-level attribution into
      // organization-level — replay could not tell who at the employer
      // made the call. The 401 gate above guarantees actorId is set.
      const [auditEvent, capsule] = await prisma.$transaction([
        prisma.auditEvent.create({
          data: {
            type: 'DECISION_TAKEN',
            hash: snapshotHash,
            referenceId: clinicianId,
            clinicianId,
            organizationId: employerId,
            metadata: {
              actorId,
              employerId,
              role,
              decisionOutcome,
              timeToDecision,
              source: 'employer_review_dashboard',
            },
          },
        }),
        prisma.decisionLearningCapsule.create({
          data: {
            clinicianId,
            employerId,
            role,
            passportSnapshot: passportSnapshot as object,
            decisionOutcome,
            timeToDecision,
          },
        }),
      ]);

      // In-memory SIEM ledger — best-effort, in-process only. Fires AFTER
      // the transaction commits so the ledger never reflects a decision
      // that was rolled back.
      // In-memory SIEM ledger gets the individual actor as `actor`; the
      // organization id moves to requestFields so downstream consumers
      // can tell person from org without inference.
      appendAuditEvent({
        category: 'DECISION',
        actor: actorId,
        resource: clinicianId,
        requestFields: { employerId, role, decisionOutcome, timeToDecision },
        resultFields: { passportSnapshotHash: snapshotHash, auditEventId: auditEvent.id },
        severity: 'INFO',
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
