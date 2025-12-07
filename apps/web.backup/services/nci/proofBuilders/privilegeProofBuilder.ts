import type { ProofEnvelope, PrivilegeVerificationRecord } from '../types';
import { buildSignedProof } from './baseProofBuilder';

export interface PrivilegeProofPayload {
  did?: string | null;
  grants: Array<{
    privilegeSetId: string;
    privilegeCodes: string[];
    status: string;
    grantedAt?: string | null;
    expiresAt?: string | null;
    dependencySatisfied: boolean;
    missingDependencies: string[];
    ehrSync?: PrivilegeVerificationRecord['ehrSync'];
  }>;
  summary: {
    total: number;
    dependencyCleared: number;
  };
}

export interface PrivilegeProofInput {
  clinicianDid?: string | null;
  grants: PrivilegeVerificationRecord[];
}

export async function buildPrivilegeProof(
  input: PrivilegeProofInput
): Promise<ProofEnvelope<PrivilegeProofPayload> | null> {
  if (!input.grants.length) {
    return null;
  }

  const grants = input.grants
    .map((grant) => ({
      privilegeSetId: grant.privilegeSetId,
      privilegeCodes: grant.privilegeCodes,
      status: grant.status,
      grantedAt: grant.grantedAt ?? null,
      expiresAt: grant.expiresAt ?? null,
      dependencySatisfied: grant.dependencySatisfied,
      missingDependencies: grant.missingDependencies,
      ehrSync: grant.ehrSync ?? undefined,
    }))
    .sort((a, b) => a.privilegeSetId.localeCompare(b.privilegeSetId));

  const payload: PrivilegeProofPayload = {
    did: input.clinicianDid,
    grants,
    summary: {
      total: grants.length,
      dependencyCleared: grants.filter((grant) => grant.dependencySatisfied).length,
    },
  };

  return buildSignedProof({
    type: 'NCI_PRIVILEGE_VERIFICATION',
    payload,
    expiresInSeconds: 30 * 60, // 30 minutes
    referenceId: grants[0]?.privilegeSetId,
  });
}

