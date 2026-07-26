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
 * The Omega Orchestrator
 *
 * Implements the core VitalCV Algorithm Canon: Start = Recognition + Acceptance
 *
 * FLOW:
 *   Omega.evaluateAction()
 *     → Recognition (buildPassportDataByNpi)
 *     → Acceptance (EmployerAcceptance persisted with decisionState snapshot)
 *     → Start (StartActivation created if action=accept)
 *     → Learning (DecisionLearningEvent recorded with PENDING outcome)
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
   * Evaluate Recognition + Acceptance to potentially mint a Start.
   * Wires the full feedback loop: decision → action → learning record.
   */
  static async evaluateAction(params: {
    npi: string;
    employerId: string;
    orgId: string;
    role?: string;
    action: 'accept' | 'request_data' | 'flag';
    comment?: string;
  }): Promise<OmegaOutput> {
    const { npi, employerId, orgId, role = 'CLINICIAN', action, comment } = params;

    // 1. Recognition Layer
    let recognition: Awaited<ReturnType<typeof buildPassportDataByNpi>> | null = null;
    try {
      recognition = await buildPassportDataByNpi(npi);
    } catch {
      // Recognition failure should not block Acceptance recording
    }

    // 2. Acceptance Layer — structured decision node
    const decisionState: string = recognition?.decisionPosture
      ? String(((recognition.decisionPosture as unknown) as Record<string, unknown>).status || 'UNKNOWN')
      : 'UNKNOWN';

    const trustSnapshot: Record<string, unknown> = {};
    if (recognition) {
      trustSnapshot.sourceCoverage = recognition.sourceCoverage ?? null;
      trustSnapshot.truth = recognition.truth ?? null;
    }

    const entity = await prisma.vcvEntity.findFirst({
      where: { displayName: { contains: orgId } },
      select: { id: true },
    });

    const acceptance = await prisma.employerAcceptance.create({
      data: {
        entityId: entity?.id || '00000000-0000-0000-0000-000000000000',
        organization: orgId,
        employerId,
        clinicianNpi: npi,
        status: action.toUpperCase(),
        acceptedAt: new Date(),
        metadata: JSON.parse(JSON.stringify({
          decisionState,
          trustSnapshot,
          comment: comment || null,
          role,
        })),
      },
    });

    // 3. Start Layer — only if action is 'accept'
    let startCreated = false;
    if (action === 'accept') {
      try {
        await prisma.startActivation.create({
          data: {
            clinicianNpi: npi,
            orgId,
            acceptanceId: acceptance.id,
            role,
            activationState: 'READY_TO_START',
            metadata: JSON.parse(JSON.stringify({ decisionState, trustSnapshot })),
          },
        });
        startCreated = true;
      } catch {
        // Start creation failure should not block Acceptance
      }
    }

    // 4. Learning Layer — record decision cycle with PENDING outcome
    let learningEvent: DecisionLearningEvent | null = null;
    if (decisionState !== 'UNKNOWN') {
      learningEvent = LearningEngine.evaluateDecisionCycle(
        npi,
        decisionState,
        String(action).toUpperCase(),
        RealWorldOutcome.PENDING,
      );
      // TODO: Persist to DB when DecisionLearningEvent model is added to schema
      console.log(
        `[Omega] Learning record: npi=${npi}, state=${decisionState}, action=${action}, outcome=PENDING, mismatch=${learningEvent.mismatchDetected}`
      );
    }

    // 5. Fetch graph state
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
      startCreated,
      learningEvent,
      nextBestAction,
    };
  }

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
