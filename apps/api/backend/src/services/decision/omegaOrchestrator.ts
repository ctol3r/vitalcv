import prisma from '../../graphql/prisma_client';
import { buildPassportDataByNpi } from '../passport/npiPassportContract';
import {
  LearningEngine,
  RealWorldOutcome,
  DecisionLearningEvent,
} from './learningEngine';
import {
  DriftReactionHandler,
  DriftEventType,
  DriftSeverity,
  DriftSourceType,
} from './driftEngine';

/**
 * The Omega Orchestrator — READ ONLY.
 *
 * `Omega.readState()` reads Recognition + the acceptance/activation graph for
 * an NPI. It creates nothing.
 *
 * `Omega.evaluateAction()` was removed in VCD-01a. It wrote an
 * `EmployerAcceptance` and a `StartActivation` for an employer and org named in
 * the caller's request body, reachable through `POST /api/omega/:npi` behind a
 * tenant guard that defaults to a no-op. VCD-00 found acceptance had five wired
 * emitters across three models; this retires one of them.
 *
 * Its only caller was that route, which now answers 404 — asserted by
 * `apps/api/backend/src/routes/__tests__/omegaDecisionWritesRetired.test.ts`.
 *
 * Do not restore a write path here. A real omega decision route needs org
 * context derived from verified membership, and should write through the single
 * acceptance route the consolidation names — see
 * `docs/product/evidence-network/canonical-transaction-baseline.md` §5.
 *
 *   DriftReactionHandler.handleEvent()
 *     → Invalidates StartActivation state in DB
 *     → Updates Learning record with real outcome (START_ACTIVATED / DRIFT_OCCURRED)
 *     → Generates HumanNotification
 */

import { generateNextBestAction as NextBestActionEngine, NbaRecommendation as NextBestActionOutput } from './nbaEngine';

/** Structured Acceptance Node — a graph node, not a flat log entry */
export interface AcceptanceGraphNode {
  id: string;
  clinicianNpi: string;
  orgId: string;
  role: string;
  decisionState: string;
  trustSignals: Record<string, unknown>;
  createdAt: string;
}

export interface StartActivationNode {
  id: string;
  acceptanceId: string | null;
  orgId: string;
  role: string;
  activationState: string;
  createdAt: string;
  activatedAt: string | null;
}

export interface OmegaOutput {
  recognition: {
    npi: string;
    decisionPosture: unknown | null;
    sourceCoverage: Record<string, unknown> | null;
  } | null;
  acceptances: AcceptanceGraphNode[];
  activations: StartActivationNode[];
  startCreated: boolean;
  learningEvent: DecisionLearningEvent | null;
  nextBestAction: NextBestActionOutput;
}

export class OmegaOrchestrator {
  /**
   * Read-only: Get the full Omega state for an NPI without creating any records.
   */
  static async readState(npi: string): Promise<OmegaOutput> {
    let recognition: Awaited<ReturnType<typeof buildPassportDataByNpi>> | null = null;
    try {
      recognition = await buildPassportDataByNpi(npi);
    } catch {
      // no-op
    }

    const priorAcceptances = await prisma.employerAcceptance.findMany({
      where: { clinicianNpi: npi },
      orderBy: { acceptedAt: 'desc' },
      take: 50,
    });

    const acceptances: AcceptanceGraphNode[] = priorAcceptances.map((a) => {
      const meta = (a.metadata as Record<string, unknown>) || {};
      return {
        id: a.id,
        clinicianNpi: a.clinicianNpi || '',
        orgId: a.organization || '',
        role: (meta.role as string) || 'UNKNOWN',
        decisionState: (meta.decisionState as string) || 'UNKNOWN',
        trustSignals: (meta.trustSnapshot as Record<string, unknown>) || {},
        createdAt: a.acceptedAt.toISOString(),
      };
    });

    const priorActivations = await prisma.startActivation.findMany({
      where: { clinicianNpi: npi },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const activations: StartActivationNode[] = priorActivations.map((a) => ({
      id: a.id,
      acceptanceId: a.acceptanceId,
      orgId: a.orgId,
      role: a.role || 'UNKNOWN',
      activationState: a.activationState,
      createdAt: a.createdAt.toISOString(),
      activatedAt: a.activatedAt?.toISOString() || null,
    }));

    const decisionState = recognition?.decisionPosture
      ? String(((recognition.decisionPosture as unknown) as Record<string, unknown>).status || 'UNKNOWN')
      : 'UNKNOWN';

    const nextBestAction = NextBestActionEngine({
      readinessPosture: (decisionState as any)?.readinessPosture,
      activationState: (activations[0]?.activationState as any) || 'NOT_STARTABLE',
      hasHardDrift: false, // Pulled from drift engine in the future
      hasSoftDrift: false,
      learningConfidenceFactor: 1.0,
    } as any);

    return {
      recognition: recognition
        ? { npi, decisionPosture: recognition.decisionPosture ?? null, sourceCoverage: recognition.sourceCoverage ?? null }
        : null,
      acceptances,
      activations,
      startCreated: false,
      learningEvent: null,
      nextBestAction,
    };
  }
}
