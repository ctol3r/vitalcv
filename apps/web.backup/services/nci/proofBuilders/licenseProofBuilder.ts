import { buildSignedProof } from './baseProofBuilder';
import type { LicenseRecordSummary, ProofEnvelope } from '../types';

export interface LicenseProofPayload {
  did?: string | null;
  totalLicenses: number;
  jurisdictions: string[];
  records: Array<Pick<LicenseRecordSummary, 'state' | 'licenseNumber' | 'status' | 'expiryDate' | 'issueDate' | 'disciplinaryFlag' | 'verifiedAt'>>;
}

export interface LicenseProofInput {
  clinicianDid?: string | null;
  licenses: LicenseRecordSummary[];
}

export async function buildLicenseProof(
  input: LicenseProofInput
): Promise<ProofEnvelope<LicenseProofPayload> | null> {
  if (!input.licenses.length) {
    return null;
  }

  const payload: LicenseProofPayload = {
    did: input.clinicianDid,
    totalLicenses: input.licenses.length,
    jurisdictions: Array.from(new Set(input.licenses.map((license) => license.state))).sort(),
    records: input.licenses
      .map((license) => ({
        state: license.state,
        licenseNumber: license.licenseNumber,
        status: license.status,
        issueDate: license.issueDate ?? null,
        expiryDate: license.expiryDate ?? null,
        disciplinaryFlag: license.disciplinaryFlag ?? undefined,
        verifiedAt: license.verifiedAt ?? license.updatedAt ?? null,
      }))
      .sort((a, b) => {
        if (a.state === b.state) {
          return a.licenseNumber.localeCompare(b.licenseNumber);
        }
        return a.state.localeCompare(b.state);
      }),
  };

  return buildSignedProof({
    type: 'NCI_LICENSE_VERIFICATION',
    payload,
    expiresInSeconds: 60 * 60, // 1 hour TTL
    referenceId: input.licenses[0]?.licenseNumber,
  });
}

