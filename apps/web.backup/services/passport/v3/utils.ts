import { canonicalizeJSON } from 'backend/src/lib/sdjwt';
import { computeBundleHash } from '../models/PassportBundle';
import type { PassportBundleManifest, PassportEnvelope, PassportProof } from './types';

export interface CanonicalizeOptions {
  includeSignature?: boolean;
}

export function canonicalizePassportEnvelope(
  envelope: PassportEnvelope,
  options: CanonicalizeOptions = {},
): string {
  const { includeSignature = false } = options;

  const plain: Record<string, unknown> = {
    passportId: envelope.passportId,
    version: envelope.version,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt ?? null,
    holder: envelope.holder,
    issuer: envelope.issuer,
    deviceBinding: envelope.deviceBinding ?? null,
    credentials: envelope.credentials.map((credential) => ({
      id: credential.id,
      domain: credential.domain,
      sourceId: credential.sourceId,
      format: credential.format,
      hash: credential.hash,
      sdJwt: credential.sdJwt,
      disclosures: [...credential.disclosures].sort(),
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt ?? null,
      metadata: sanitizeMetadata(credential.metadata),
      proofRefs: credential.proofRefs ?? [],
    })),
    proofs: envelope.proofs.map((proof) => ({
      proofId: proof.proofId,
      proofType: proof.proofType,
      anchorId: proof.anchorId ?? null,
      eventType: proof.eventType ?? null,
      recordedAt: proof.recordedAt,
      metadata: sanitizeMetadata(proof.metadata),
    })),
    summary: envelope.summary,
  };

  if (includeSignature && envelope.signature) {
    plain.signature = envelope.signature;
  }

  return canonicalizeJSON(plain);
}

export function computePassportEnvelopeHash(envelope: PassportEnvelope): string {
  const canonical = canonicalizePassportEnvelope(envelope, { includeSignature: false });
  return computeBundleHash(Buffer.from(canonical, 'utf-8'));
}

export function mapProofs(proofs: PassportProof[]): Record<string, PassportProof> {
  return proofs.reduce<Record<string, PassportProof>>((acc, proof) => {
    acc[proof.proofId] = proof;
    return acc;
  }, {});
}

export function toBundleManifest(envelope: PassportEnvelope): PassportBundleManifest {
  return {
    bundleId: envelope.passportId,
    did: envelope.holder.did,
    generatedAt: envelope.issuedAt,
    clinician: {
      id: envelope.holder.clinicianId,
      npi: envelope.holder.npi,
      name: envelope.holder.name,
      state: envelope.holder.state,
    },
    credentials: envelope.credentials.reduce<
      PassportBundleManifest['credentials']
    >((acc, credential) => {
      acc[credential.id] = {
        domain: credential.domain,
        hash: credential.hash,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt ?? undefined,
      };
      return acc;
    }, {}),
    proofs: envelope.proofs,
  };
}

function sanitizeMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) {
    return null;
  }
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  if (!entries.length) {
    return null;
  }

  return entries.reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key] = value as unknown;
    return acc;
  }, {});
}

