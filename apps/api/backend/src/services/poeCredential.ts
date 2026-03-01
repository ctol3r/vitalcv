import { getConfiguredIssuerDid } from '../utils/issuerDid';
import { sha256ForPayload } from '../utils/deterministic';
import { randomUUID } from 'node:crypto';

// ── PoE Credential Types ─────────────────────────────────────

export const POE_VC_CONTEXT = [
  'https://www.w3.org/ns/credentials/v2',
  'https://www.w3.org/2018/credentials/v1',
] as const;

export const POE_VC_TYPES = [
  'VerifiableCredential',
  'ProofOfExperienceCredential',
] as const;

export interface PoeCredentialSubject {
  id: string;
  procedure_type: string;
  volume_window: string;
  volume_count: number;
  non_phi_hash_tree: string;
  leaf_hashes: readonly string[];
  computed_at: string;
}

export interface PoeVerifiableCredential {
  '@context': readonly string[];
  id: string;
  type: readonly string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: PoeCredentialSubject;
}

export interface SignedPoeVerifiableCredential extends PoeVerifiableCredential {
  signature: string;
  signatureAlgorithm: 'ES256';
}

// ── Builder ──────────────────────────────────────────────────

export interface BuildPoeVcInput {
  procedureType: string;
  volumeWindow: string;
  merkleRoot: string;
  volumeCount: number;
  leafHashes: readonly string[];
  computedAt: string;
  clinicianDid?: string;
}

export function buildPoeVc(input: BuildPoeVcInput): PoeVerifiableCredential {
  if (!input.procedureType || input.procedureType.trim().length === 0) {
    throw new Error('procedureType is required');
  }
  if (!input.volumeWindow || input.volumeWindow.trim().length === 0) {
    throw new Error('volumeWindow is required');
  }
  if (!input.merkleRoot || input.merkleRoot.trim().length === 0) {
    throw new Error('merkleRoot is required');
  }
  if (input.volumeCount <= 0) {
    throw new Error('volumeCount must be positive');
  }

  const credentialId = `urn:vitalcv:poe:${randomUUID()}`;
  const subjectId = input.clinicianDid ?? `did:vitalcv:clinician:${randomUUID()}`;

  return {
    '@context': [...POE_VC_CONTEXT],
    id: credentialId,
    type: [...POE_VC_TYPES],
    issuer: getConfiguredIssuerDid(),
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: subjectId,
      procedure_type: input.procedureType.trim(),
      volume_window: input.volumeWindow.trim(),
      volume_count: input.volumeCount,
      non_phi_hash_tree: input.merkleRoot,
      leaf_hashes: input.leafHashes,
      computed_at: input.computedAt,
    },
  };
}

export function computePoeVcHash(vc: PoeVerifiableCredential): string {
  return sha256ForPayload(vc);
}

export function attachPoeSignature(
  vc: PoeVerifiableCredential,
  signature: string,
): SignedPoeVerifiableCredential {
  return {
    ...vc,
    signature,
    signatureAlgorithm: 'ES256',
  };
}
