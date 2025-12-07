import type { PrismaClient, PayerEnrollmentV2 } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger.js';
import {
  evaluatePayerEligibility,
  type PayerEligibilityInput,
} from './eligibilityEngine.js';
import {
  detectPayerDiscrepancies,
  type DiscrepancyFinding,
  type DiscrepancyContext,
  type CaqhDiscrepancySnapshot,
} from './detectPayerDiscrepancies.js';
import type { DriftSeverity, DriftSignalType } from '../drift/types.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('payer/drift');

type PrismaLike = Pick<
  PrismaClient,
  'payerEnrollmentV2' | 'payer' | 'clinicianProfile'
>;

export interface PayerDriftInput {
  type: DriftSignalType;
  severity: DriftSeverity;
  enrollmentId: string;
}

export interface PayerDriftOutcome {
  eligibility: ReturnType<typeof evaluatePayerEligibility>;
  discrepancies: DiscrepancyFinding[];
}

const PAYER_DRIFT_TYPES: DriftSignalType[] = [
  'PAYER_REVALIDATION_DUE',
  'PAYER_STATUS_MISMATCH',
];

export async function handlePayerDrift(
  input: PayerDriftInput,
  options: { prisma?: PrismaLike } = {}
): Promise<PayerDriftOutcome | null> {
  if (!PAYER_DRIFT_TYPES.includes(input.type) || input.severity !== 'critical') {
    return null;
  }

  const client = options.prisma ?? (prisma as PrismaLike);
  const enrollment = await client.payerEnrollmentV2.findUnique({
    where: { id: input.enrollmentId },
    include: {
      payer: true,
      clinician: true,
    },
  });

  if (!enrollment || !enrollment.payer || !enrollment.clinician) {
    log.warn('[PayerDrift] Missing enrollment context', {
      enrollmentId: input.enrollmentId,
    });
    return null;
  }

  const eligibilityInput = buildEligibilityInput(enrollment);
  const eligibility = evaluatePayerEligibility(eligibilityInput);

  const discrepancies = detectPayerDiscrepancies({
    clinicianId: enrollment.clinicianId,
    clinicianSpecialty: enrollment.clinician.specialty,
    targetState: enrollment.payer.states[0],
    caqh: extractCaqhSnapshot(enrollment.metadata),
    payer: {
      id: enrollment.payer.id,
      name: enrollment.payer.name,
      requiresCaqh: enrollment.payer.requiresCaqh ?? undefined,
      specialty: enrollment.payer.specialty ?? undefined,
      states: enrollment.payer.states ?? undefined,
    },
    enrollment: normalizeEnrollment(enrollment),
  });

  await client.payerEnrollmentV2.update({
    where: { id: enrollment.id },
    data: {
      metadata: {
        ...(enrollment.metadata as Record<string, unknown> | null) ?? {},
        lastDriftEligibility: {
          overallStatus: eligibility.overallStatus,
          blockers: eligibility.blockers,
          evaluatedAt: eligibility.evaluatedAt.toISOString(),
        },
        driftDiscrepancies: discrepancies,
      },
      lastStatusChange: new Date(),
    },
  });

  log.info('[PayerDrift] Eligibility recalculated', {
    enrollmentId: enrollment.id,
    overallStatus: eligibility.overallStatus,
    discrepancyCount: discrepancies.length,
  });

  return {
    eligibility,
    discrepancies,
  };
}

function buildEligibilityInput(enrollment: PayerEnrollmentV2 & {
  clinician: { specialty: string; id: string };
  payer: PayerEnrollmentV2['payer'];
}): PayerEligibilityInput {
  const metadata = (enrollment.metadata as Record<string, any>) ?? {};
  return {
    clinicianId: enrollment.clinicianId,
    payerId: enrollment.payerId,
    specialty: enrollment.clinician.specialty,
    caqh: metadata.caqh ?? undefined,
    boardCertification: metadata.boardCertification ?? undefined,
    dea: metadata.dea ?? undefined,
    pecos: metadata.pecos ?? undefined,
    medicaid: metadata.medicaid ?? undefined,
  };
}

function extractCaqhSnapshot(metadata: unknown): CaqhDiscrepancySnapshot | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  const record = metadata as Record<string, any>;
  if (!record.caqh) {
    return undefined;
  }
  return {
    hasProfile: Boolean(record.caqh.hasProfile),
    missingSections: record.caqh.missingSections ?? [],
    specialtyCodes: record.caqh.specialtyCodes ?? [],
    malpractice: record.caqh.malpractice ?? null,
  };
}

function normalizeEnrollment(enrollment: PayerEnrollmentV2): DiscrepancyContext['enrollment'] {
  return {
    id: enrollment.id,
    clinicianId: enrollment.clinicianId,
    payerId: enrollment.payerId,
    status: enrollment.status,
    effectiveDate: enrollment.effectiveDate,
    panelType: enrollment.panelType,
    notes: enrollment.notes,
    metadata: enrollment.metadata as Record<string, unknown> | null,
    lastStatusChange: enrollment.lastStatusChange,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
  };
}

