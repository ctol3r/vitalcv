import prisma from '../../graphql/prisma_client';
import { buildPassportDataByNpi } from '../passport/npiPassportContract';

/**
 * The Omega Orchestrator
 *
 * Implements the core VitalCV Algorithm Canon: Start = Recognition + Acceptance
 *
 * This is a thin layer governing the boundaries between the objective trust network
 * (Recognition) and the subjective employer decision (Acceptance), culminating in a
 * material hiring event (Start).
 */

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
}

export class OmegaOrchestrator {
  /**
   * Evaluate Recognition + Acceptance to potentially mint a Start.
   * Acceptance is persisted as a structured decision node (graph, not log).
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
    const decisionState = recognition?.decisionPosture
      ? ((recognition.decisionPosture as unknown) as Record<string, unknown>).status || 'UNKNOWN'
      : 'UNKNOWN';

    const trustSnapshot: Record<string, unknown> = {};
    if (recognition) {
      trustSnapshot.sourceCoverage = recognition.sourceCoverage ?? null;
      trustSnapshot.truth = recognition.truth ?? null;
    }

    // Look up entityId for the organization (required by schema)
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
        // Start attestation failure should not block Acceptance
      }
    }

    // 4. Fetch all prior acceptances for this NPI (graph history)
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
        orgId: a.organization,
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

    return {
      recognition: recognition
        ? {
            npi,
            decisionPosture: recognition.decisionPosture ?? null,
            sourceCoverage: recognition.sourceCoverage ?? null,
          }
        : null,
      acceptances,
      activations,
      startCreated,
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
        orgId: a.organization,
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

    return {
      recognition: recognition
        ? {
            npi,
            decisionPosture: recognition.decisionPosture ?? null,
            sourceCoverage: recognition.sourceCoverage ?? null,
          }
        : null,
      acceptances,
      activations,
      startCreated: false,
    };
  }
}
