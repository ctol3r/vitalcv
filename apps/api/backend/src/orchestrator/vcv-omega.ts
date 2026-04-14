/**
 * vcv-omega.ts — Omega Orchestrator (minimal scaffold).
 *
 * Wraps existing VitalCV modules into a single entry point. This file
 * MUST NOT reimplement any trust, decision, coverage, claim, or reuse
 * logic — it only orchestrates calls to the services that already own
 * those responsibilities and assembles the result.
 *
 * Owned by the services this delegates to:
 *   - decision / coverage / claims → buildPassportDataByNpi
 *   - reuse_signal                → computeReuseSignal
 *   - recent actions              → prisma.actionLog (read-only)
 */

import prisma from '../graphql/prisma_client';
import { buildPassportDataByNpi, type PassportDataContract } from '../services/passport/npiPassportContract';
import { computeReuseSignal, type ReuseSignal } from '../services/actions/reuseSignal';
import { computeDriftSignal, type DriftSignal } from './drift';
import { deriveNextBestAction, type NextBestAction } from '../services/intelligence/nextBestAction';
import { emit } from '../services/events/eventBus';
import { HARD_DRIFT_EVENT, SOFT_DRIFT_EVENT } from '../services/events/driftReactionHandler';
import { log } from '../obs/logger';

export interface OmegaRequest {
  subject: { npi: string };
  context?: {
    orgId?: string;
    role?: string;
    persist?: boolean;
  };
}

export interface OmegaRecentAction {
  id: string;
  action: string;
  rationale: string | null;
  createdAt: string;
}

export interface OmegaAcceptanceEvent {
  kind: 'acceptance' | 'snapshot';
  id: string;
  occurredAt: string;
  decisionState: string | null;
  role: string | null;
  employerId: string | null;
  trustSignalsSnapshot: unknown;
  acceptanceId: string | null;
}

export interface OmegaAcceptance {
  latest: OmegaAcceptanceEvent;
  history: OmegaAcceptanceEvent[];
}

export interface OmegaActivation {
  id: string;
  clinicianNpi: string;
  orgId: string | null;
  acceptanceRef: string;
  activationState: string;
  activatedAt: string | null;
  createdAt: string;
}

export type OmegaStatus = 'ok' | 'not_found' | 'partial';

export interface OmegaResponse {
  status: OmegaStatus;
  subject: { npi: string };
  context: Required<NonNullable<OmegaRequest['context']>>;
  decision: PassportDataContract['decision'] | null;
  coverage: PassportDataContract['sourceCoverage'] | null;
  claims: PassportDataContract['truth'] | null;
  reuse_signal: ReuseSignal | null;
  recent_actions: OmegaRecentAction[];
  acceptance: OmegaAcceptance | null;
  activation: OmegaActivation | null;
  drift: DriftSignal;
  nextBestAction: NextBestAction;
  generatedAt: string;
}

const NPI_RE = /^\d{10}$/;
const EMPTY_REUSE_SIGNAL: ReuseSignal = {
  accepted_count: 0,
  flagged_count: 0,
  request_data_count: 0,
  last_action: null,
  last_action_at: null,
};

function resolveContext(context: OmegaRequest['context']): Required<NonNullable<OmegaRequest['context']>> {
  return {
    orgId: context?.orgId ?? '',
    role: context?.role ?? 'viewer',
    persist: context?.persist ?? false,
  };
}

function isValidNpi(npi: string): boolean {
  return NPI_RE.test(npi);
}

/**
 * Orchestrate a single Omega request. Fans out to existing services in
 * parallel; tolerates reuse/action-layer failures without collapsing the
 * core response — status is downgraded to "partial" instead.
 */
export async function orchestrateOmega(request: OmegaRequest): Promise<OmegaResponse> {
  const npi = request.subject?.npi ?? '';
  const context = resolveContext(request.context);
  const generatedAt = new Date().toISOString();

  if (!isValidNpi(npi)) {
    return {
      status: 'not_found',
      subject: { npi },
      context,
      decision: null,
      coverage: null,
      claims: null,
      reuse_signal: null,
      recent_actions: [],
      acceptance: null,
      activation: null,
      drift: computeDriftSignal({ passport: null, reuseSignal: null }),
      nextBestAction: {
        action: 'REVIEW_MANUALLY',
        reason: 'Invalid NPI — no learning data to evaluate.',
        confidence: 0,
        evidenceCount: 0,
      },
      generatedAt,
    };
  }

  const [
    passportResult,
    reuseResult,
    actionResult,
    acceptanceResult,
    snapshotResult,
    activationResult,
  ] = await Promise.allSettled([
    buildPassportDataByNpi(npi),
    computeReuseSignal(npi),
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
        id: true,
        acceptanceId: true,
        employerId: true,
        acceptedAt: true,
        decisionState: true,
        trustSignalsSnapshot: true,
        role: true,
      },
    }),
    prisma.acceptanceSnapshot.findMany({
      where: { clinicianNpi: npi },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.startActivation.findFirst({
      where: { clinicianNpi: npi },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const passport = passportResult.status === 'fulfilled' ? passportResult.value : null;
  const reuseFailed = reuseResult.status === 'rejected';
  const actionsFailed = actionResult.status === 'rejected';
  const acceptanceFailed = acceptanceResult.status === 'rejected';
  const snapshotFailed = snapshotResult.status === 'rejected';
  const activationFailed = activationResult.status === 'rejected';

  if (reuseFailed) {
    log('warn', 'omega_reuse_signal_failed', {
      npi_prefix: npi.slice(0, 4) + '····',
      message:
        reuseResult.reason instanceof Error ? reuseResult.reason.message : 'unknown',
    });
  }
  if (actionsFailed) {
    log('warn', 'omega_action_log_failed', {
      npi_prefix: npi.slice(0, 4) + '····',
      message:
        actionResult.reason instanceof Error ? actionResult.reason.message : 'unknown',
    });
  }
  if (acceptanceFailed) {
    log('warn', 'omega_acceptance_read_failed', {
      npi_prefix: npi.slice(0, 4) + '····',
      message:
        acceptanceResult.reason instanceof Error ? acceptanceResult.reason.message : 'unknown',
    });
  }
  if (snapshotFailed) {
    log('warn', 'omega_acceptance_snapshot_failed', {
      npi_prefix: npi.slice(0, 4) + '····',
      message:
        snapshotResult.reason instanceof Error ? snapshotResult.reason.message : 'unknown',
    });
  }
  if (activationFailed) {
    log('warn', 'omega_start_activation_failed', {
      npi_prefix: npi.slice(0, 4) + '····',
      message:
        activationResult.reason instanceof Error ? activationResult.reason.message : 'unknown',
    });
  }

  const acceptance: OmegaAcceptance | null = buildAcceptanceView(
    acceptanceResult.status === 'fulfilled' ? acceptanceResult.value : [],
    snapshotResult.status === 'fulfilled' ? snapshotResult.value : [],
  );

  const activation: OmegaActivation | null =
    activationResult.status === 'fulfilled' && activationResult.value
      ? mapActivationRow(activationResult.value)
      : null;

  const drift: DriftSignal = computeDriftSignal({
    passport: passportResult.status === 'fulfilled' ? passportResult.value : null,
    reuseSignal: reuseResult.status === 'fulfilled' ? reuseResult.value : null,
  });

  // Emit drift events on the in-process bus. The bus swallows handler
  // failures so the decision path is protected. Fire-and-forget with
  // await so the handler has a chance to run before response is sent.
  if (drift.state === 'HARD_DRIFT' || drift.state === 'SOFT_DRIFT') {
    await emit({
      type: drift.state === 'HARD_DRIFT' ? HARD_DRIFT_EVENT : SOFT_DRIFT_EVENT,
      clinicianNpi: npi,
      source: 'omega',
      severity: drift.state,
      timestamp: drift.lastChecked,
      payload: { reasons: drift.reasons },
    });
  }

  // Data-driven NBA — derived from learning history, never from rules.
  const nextBestAction = await deriveNextBestAction(npi);

  if (!passport) {
    return {
      status: 'not_found',
      subject: { npi },
      context,
      decision: null,
      coverage: null,
      claims: null,
      reuse_signal: reuseResult.status === 'fulfilled' ? reuseResult.value : EMPTY_REUSE_SIGNAL,
      recent_actions:
        actionResult.status === 'fulfilled'
          ? actionResult.value.map((entry) => ({
              id: entry.id,
              action: entry.action,
              rationale: entry.rationale,
              createdAt: entry.createdAt.toISOString(),
            }))
          : [],
      acceptance,
      activation,
      drift,
      nextBestAction,
      generatedAt,
    };
  }

  const reuse_signal = reuseResult.status === 'fulfilled' ? reuseResult.value : EMPTY_REUSE_SIGNAL;
  const recent_actions: OmegaRecentAction[] =
    actionResult.status === 'fulfilled'
      ? actionResult.value.map((entry) => ({
          id: entry.id,
          action: entry.action,
          rationale: entry.rationale,
          createdAt: entry.createdAt.toISOString(),
        }))
      : [];

  return {
    status:
      reuseFailed || actionsFailed || acceptanceFailed || snapshotFailed || activationFailed
        ? 'partial'
        : 'ok',
    subject: { npi },
    context,
    decision: passport.decision,
    coverage: passport.sourceCoverage,
    claims: passport.truth,
    reuse_signal,
    recent_actions,
    acceptance,
    activation,
    drift,
    nextBestAction,
    generatedAt,
  };
}

type StartActivationRow = {
  id: string;
  clinicianNpi: string;
  orgId: string | null;
  acceptanceRef: string;
  activationState: string;
  activatedAt: Date | null;
  createdAt: Date;
};

function mapActivationRow(row: StartActivationRow): OmegaActivation {
  return {
    id: row.id,
    clinicianNpi: row.clinicianNpi,
    orgId: row.orgId,
    acceptanceRef: row.acceptanceRef,
    activationState: row.activationState,
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

type AcceptanceRow = {
  id: string;
  acceptanceId: string;
  employerId: string;
  acceptedAt: Date;
  decisionState: string | null;
  trustSignalsSnapshot: unknown;
  role: string | null;
};

type SnapshotRow = {
  id: string;
  clinicianNpi: string;
  decisionState: string;
  trustSignalsSnapshot: unknown;
  role: string | null;
  createdAt: Date;
  acceptanceId: string | null;
};

function buildAcceptanceView(
  acceptances: AcceptanceRow[],
  snapshots: SnapshotRow[],
): OmegaAcceptance | null {
  if (acceptances.length === 0 && snapshots.length === 0) {
    return null;
  }

  const events: OmegaAcceptanceEvent[] = [
    ...acceptances.map<OmegaAcceptanceEvent>((row) => ({
      kind: 'acceptance',
      id: row.id,
      occurredAt: row.acceptedAt.toISOString(),
      decisionState: row.decisionState,
      role: row.role,
      employerId: row.employerId,
      trustSignalsSnapshot: row.trustSignalsSnapshot,
      acceptanceId: row.acceptanceId,
    })),
    ...snapshots.map<OmegaAcceptanceEvent>((row) => ({
      kind: 'snapshot',
      id: row.id,
      occurredAt: row.createdAt.toISOString(),
      decisionState: row.decisionState,
      role: row.role,
      employerId: null,
      trustSignalsSnapshot: row.trustSignalsSnapshot,
      acceptanceId: row.acceptanceId,
    })),
  ];

  events.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));

  return {
    latest: events[0]!,
    history: events,
  };
}
