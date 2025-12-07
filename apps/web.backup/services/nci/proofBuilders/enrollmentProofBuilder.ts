import type { EnrollmentRecordSummary, ProofEnvelope } from '../types';
import type { PecosEvidenceSummary } from '../../psv/evidenceBundle';
import { buildSignedProof } from './baseProofBuilder';

export interface EnrollmentProofPayload {
  did?: string | null;
  pecos?: {
    providerId?: string;
    status?: string;
    lastCheckedAt?: string | null;
    revalidationDate?: string | null;
  } | null;
  medicaidStates: string[];
  payerEnrollments: Array<{
    payerId: string;
    payerName: string;
    status: string;
    states: string[];
    effectiveDate?: string | null;
    updatedAt?: string | null;
  }>;
  freshness: {
    payerUpdatedAt?: string | null;
    pecosCheckedAt?: string | null;
    generatedAt: string;
  };
  timelineAnchors: Array<{
    referenceId: string;
    status: string;
    occurredAt?: string | null;
  }>;
}

export interface EnrollmentProofInput {
  clinicianDid?: string | null;
  enrollments: EnrollmentRecordSummary[];
  pecosSummary?: PecosEvidenceSummary | null;
}

export async function buildEnrollmentProof(
  input: EnrollmentProofInput
): Promise<ProofEnvelope<EnrollmentProofPayload> | null> {
  if (!input.enrollments.length && !input.pecosSummary) {
    return null;
  }

  const payerEnrollments = input.enrollments
    .map((record) => ({
      payerId: record.payerId,
      payerName: record.payerName,
      status: record.status,
      states: record.states,
      effectiveDate: record.effectiveDate ?? null,
      updatedAt: record.updatedAt ?? null,
    }))
    .sort((a, b) => a.payerId.localeCompare(b.payerId));

  const latestPayerUpdate = payerEnrollments.reduce<string | null>((memo, record) => {
    if (!record.updatedAt) return memo;
    if (!memo || record.updatedAt > memo) {
      return record.updatedAt;
    }
    return memo;
  }, null);

  const medicaidStates = input.enrollments
    .filter((record) => record.planTypes?.some((plan) => plan.toLowerCase().includes('medicaid')))
    .flatMap((record) => record.states)
    .filter((state, index, arr) => arr.indexOf(state) === index);

  const timelineAnchors = payerEnrollments.slice(0, 25).map((record) => ({
    referenceId: record.payerId,
    status: record.status,
    occurredAt: record.updatedAt ?? record.effectiveDate ?? null,
  }));

  const payload: EnrollmentProofPayload = {
    did: input.clinicianDid,
    pecos: input.pecosSummary?.provider
      ? {
          providerId: input.pecosSummary.provider.providerId,
          status: input.pecosSummary.provider.status,
          lastCheckedAt: input.pecosSummary.provider.lastCheckedAt,
          revalidationDate: input.pecosSummary.provider.revalidationDate,
        }
      : null,
    medicaidStates,
    payerEnrollments,
    freshness: {
      payerUpdatedAt: latestPayerUpdate,
      pecosCheckedAt: input.pecosSummary?.provider?.lastCheckedAt ?? null,
      generatedAt: new Date().toISOString(),
    },
    timelineAnchors,
  };

  return buildSignedProof({
    type: 'NCI_ENROLLMENT_VERIFICATION',
    payload,
    expiresInSeconds: 60 * 60, // 1 hour
    referenceId: payerEnrollments[0]?.payerId ?? input.pecosSummary?.clinicianId,
  });
}

