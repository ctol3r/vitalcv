/**
 * actionLog.ts — employer action endpoint (single surface).
 *
 * POST /api/employer-actions
 *   Routes "accept" to the existing Acceptance system (no write here) and
 *   persists non-accept actions (request_data | flag) to the ActionLog
 *   table.
 *
 * GET /api/employer-actions/:npi
 *   Returns the 10 most recent non-accept actions for an NPI.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { buildPassportDataByNpi } from '../services/passport/npiPassportContract';
import { computeReuseSignal } from '../services/actions/reuseSignal';
import { hashAttestation } from '../services/attestation/canonicalize';
import { logEvent } from '../services/audit/eventWriter';

const NPI_RE = /^\d{10}$/;
const VALID_ACTIONS = new Set(['accept', 'request_data', 'flag'] as const);
type ActionKind = 'accept' | 'request_data' | 'flag';

interface ActionRequestBody {
  npi?: unknown;
  action?: unknown;
  rationale?: unknown;
}

function isActionKind(value: unknown): value is ActionKind {
  return typeof value === 'string' && VALID_ACTIONS.has(value as ActionKind);
}

/**
 * Best-effort tamper-evident attestation write. NEVER throws back to
 * the caller — attestation failures must not block the action route.
 */
interface AttestationActorContext {
  actorId?: string | null;
  organizationId?: string | null;
}

async function recordDecisionAttestation(
  npi: string,
  action: ActionKind,
  actor: AttestationActorContext = {},
): Promise<{ hash: string; decisionState: string } | null> {
  try {
    const [passportResult, reuseResult] = await Promise.allSettled([
      buildPassportDataByNpi(npi),
      computeReuseSignal(npi),
    ]);
    const passport = passportResult.status === 'fulfilled' ? passportResult.value : null;
    const reuse = reuseResult.status === 'fulfilled' ? reuseResult.value : null;
    const decisionState = passport?.decision.decision ?? 'UNKNOWN';

    const decisionTimestamp = new Date();
    const snapshot = {
      evidence: passport?.sourceCoverage ?? null,
      coverage: passport?.sourceCoverage ?? null,
      trustSignals: { reuse },
      nextBestAction: null, // surfaced via /api/omega; not duplicated in attestation snapshot
      capturedAt: decisionTimestamp.toISOString(),
    };

    // Hash envelope is deterministic over (subject, action, decision,
    // timestamp, canonicalized snapshot). Anyone with the row can
    // recompute and verify integrity.
    const hash = hashAttestation({
      clinicianNpi: npi,
      actionTaken: action,
      decisionState,
      decisionTimestamp: decisionTimestamp.toISOString(),
      snapshot,
    });

    await prisma.decisionAttestation.create({
      data: {
        clinicianNpi: npi,
        actionTaken: action,
        decisionState,
        decisionTimestamp,
        snapshot: snapshot as never,
        hash,
        actorId: actor.actorId ?? null,
        organizationId: actor.organizationId ?? null,
      },
    });
    return { hash, decisionState };
  } catch (error) {
    log('warn', 'decision_attestation_write_failed', {
      npi_prefix: npi.slice(0, 4) + '····',
      action,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

const ACTION_AUDIT_EVENT_TYPE: Record<ActionKind, string> = {
  accept: 'employer.accepted_head_start',
  request_data: 'employer.requested_more_data',
  flag: 'employer.flagged_for_review',
};

export function registerActionLogRoutes(app: Express): void {
  app.post('/api/employer-actions', async (req: Request, res: Response) => {
    // Pull actor context from the existing apiAuth middleware (req.auth).
    // Falls back to nulls when the request is unauthenticated — actor
    // attribution is additive and best-effort, not a gate.
    const actor = {
      actorId: req.auth?.keyId ?? req.auth?.clinicianId ?? null,
      organizationId: null as string | null,
    };
    const body = (req.body ?? {}) as ActionRequestBody;
    const { npi, action, rationale } = body;

    if (typeof npi !== 'string' || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit string.',
      });
    }
    if (!isActionKind(action)) {
      return res.status(400).json({
        error: 'invalid_action',
        error_description: 'action must be one of: accept, request_data, flag.',
      });
    }
    if (rationale !== undefined && typeof rationale !== 'string') {
      return res.status(400).json({
        error: 'invalid_rationale',
        error_description: 'rationale must be a string when provided.',
      });
    }

    // Accept is owned by the existing Acceptance audit system — we do NOT
    // write to Acceptance here. We DO record a sidecar AcceptanceSnapshot
    // capturing decision + reuse state at the moment of action, so the
    // system has replayable memory of what the operator saw when they
    // clicked accept. Snapshot failure must not block the action.
    if (action === 'accept') {
      try {
        const [passportData, reuseSignal] = await Promise.allSettled([
          buildPassportDataByNpi(npi),
          computeReuseSignal(npi),
        ]);

        const decisionState =
          passportData.status === 'fulfilled' && passportData.value
            ? passportData.value.decision.decision
            : 'UNKNOWN';
        // Serialize to plain JSON-compatible shape for Prisma's Json field.
        const trustSignalsSnapshot = JSON.parse(
          JSON.stringify({
            reuse:
              reuseSignal.status === 'fulfilled'
                ? reuseSignal.value
                : null,
            captured_at: new Date().toISOString(),
          }),
        );

        await prisma.acceptanceSnapshot.create({
          data: {
            clinicianNpi: npi,
            decisionState,
            trustSignalsSnapshot,
            role: null,
          },
        });
      } catch (error) {
        // Snapshot is best-effort — do not fail the action.
        log('warn', 'acceptance_snapshot_write_failed', {
          npi_prefix: npi.slice(0, 4) + '····',
          message: error instanceof Error ? error.message : 'unknown',
        });
      }

      // Tamper-evident attestation — best-effort, never blocks.
      const attestation = await recordDecisionAttestation(npi, action, actor);
      // Audit-event chain — fire-and-forget; outputsHash is the
      // attestation digest so external auditors can correlate.
      await logEvent({
        eventType: ACTION_AUDIT_EVENT_TYPE[action],
        subjectNpi: npi,
        actorId: actor.actorId,
        organizationId: actor.organizationId,
        outputsHash: attestation?.hash ?? null,
        metadata: {
          action,
          decisionState: attestation?.decisionState ?? null,
        },
      });

      log('info', 'employer_action_routed', {
        npi_prefix: npi.slice(0, 4) + '····',
        action,
        routed: 'acceptance_system',
      });
      return res.status(200).json({
        success: true,
        routed: 'acceptance_system',
      });
    }

    try {
      await prisma.actionLog.create({
        data: {
          npi,
          action,
          rationale: rationale ?? null,
        },
      });
    } catch (error) {
      log('error', 'employer_action_persist_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        action,
        message: error instanceof Error ? error.message : 'Unknown persistence error',
      });
      return res.status(500).json({
        success: false,
        error: 'persist_failed',
        error_description: 'Could not record employer action.',
      });
    }

    // Tamper-evident attestation — best-effort, never blocks.
    const nonAcceptAttestation = await recordDecisionAttestation(npi, action, actor);
    // Audit-event chain for non-accept actions — symmetry with the
    // accept path above.
    await logEvent({
      eventType: ACTION_AUDIT_EVENT_TYPE[action],
      subjectNpi: npi,
      actorId: actor.actorId,
      organizationId: actor.organizationId,
      outputsHash: nonAcceptAttestation?.hash ?? null,
      metadata: {
        action,
        decisionState: nonAcceptAttestation?.decisionState ?? null,
      },
    });

    log('info', 'employer_action_recorded', {
      npi_prefix: npi.slice(0, 4) + '····',
      action,
    });

    return res.status(200).json({
      success: true,
      action,
      npi,
      recorded: true,
    });
  });

  app.get('/api/employer-actions/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit string.',
      });
    }

    // Read both surfaces in parallel. Acceptance rows are the structured
    // graph-node view; ActionLog rows are the lightweight log of
    // non-accept actions. Both are keyed by npi (Acceptance.subjectId ≡ npi
    // per Wave 13 simplification).
    const [actionsResult, acceptanceResult] = await Promise.allSettled([
      prisma.actionLog.findMany({
        where: { npi },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.acceptance.findMany({
        where: { subjectId: npi },
        orderBy: { acceptedAt: 'desc' },
        take: 10,
        select: {
          acceptanceId: true,
          subjectId: true,
          employerId: true,
          facilityId: true,
          acceptedAt: true,
          eventHash: true,
          decisionState: true,
          trustSignalsSnapshot: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    if (actionsResult.status === 'rejected' && acceptanceResult.status === 'rejected') {
      log('error', 'employer_action_read_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        actions_error:
          actionsResult.reason instanceof Error ? actionsResult.reason.message : 'unknown',
        acceptance_error:
          acceptanceResult.reason instanceof Error ? acceptanceResult.reason.message : 'unknown',
      });
      return res
        .status(200)
        .json({ actions: [], acceptances: [], error: 'read_failed' });
    }

    const actions =
      actionsResult.status === 'fulfilled' ? actionsResult.value : [];
    const acceptances =
      acceptanceResult.status === 'fulfilled'
        ? acceptanceResult.value.map((row) => ({
            kind: 'acceptance' as const,
            acceptanceId: row.acceptanceId,
            subjectId: row.subjectId,
            employerId: row.employerId,
            facilityId: row.facilityId,
            acceptedAt: row.acceptedAt.toISOString(),
            eventHash: row.eventHash,
            decisionState: row.decisionState,
            trustSignalsSnapshot: row.trustSignalsSnapshot,
            role: row.role,
            createdAt: row.createdAt.toISOString(),
          }))
        : [];

    return res.status(200).json({ actions, acceptances });
  });
}
