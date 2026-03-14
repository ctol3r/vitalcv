import {
  buildCanonicalClaimsFromArtifact,
  buildSelectiveDisclosurePlaceholder,
  type SelectiveDisclosurePlaceholder,
} from '../auditBundleClaims';
import { sha256ForPayload } from '../../utils/deterministic';

export interface AuditScrapbookLedgerAnchor {
  artifactId: string | null;
  merkleRoot: string | null;
  checksum: string | null;
  chainDigest: string | null;
}

export interface AuditScrapbookVerificationMetadata {
  status: string;
  verifiedAt: string;
  freshUntil: string | null;
  sourceType: string | null;
  organizationId: string | null;
  sourceResponseHash?: string;
  normalizedFactsHash?: string;
}

export interface AuditScrapbookProvenanceEntry {
  createdAt: string;
  fingerprint: string;
  merkleRoot: string;
  lifecycleState: string;
}

export interface AuditScrapbookBundleEntry {
  credentialId: string;
  verificationArtifactId: string | null;
  credentialType: string;
  source: string;
  sourceResponseArtifact: Record<string, unknown>;
  normalizedCredentialFacts: Record<string, unknown>;
  verificationMetadata: AuditScrapbookVerificationMetadata;
  verificationMethod: string;
  verifiedAt: string;
  verifierAgent: string;
  evidenceHash: string;
  provenanceChain: AuditScrapbookProvenanceEntry[];
  ledgerAnchor: AuditScrapbookLedgerAnchor;
  disclosureFrame: SelectiveDisclosurePlaceholder;
  decisionCapsuleIds: string[];
  decisionTypes: string[];
}

export interface BuildAuditScrapbookEntryInput {
  credentialId: string;
  verificationArtifactId?: string | null;
  subjectNpi: string;
  credentialType: string;
  source: string;
  status: string;
  sourceResponseArtifact: Record<string, unknown>;
  normalizedCredentialFacts: Record<string, unknown>;
  verificationMethod: string;
  verificationMetadata: AuditScrapbookVerificationMetadata;
  verifiedAt: string;
  verifierAgent: string;
  provenanceChain: AuditScrapbookProvenanceEntry[];
  ledgerAnchor: AuditScrapbookLedgerAnchor;
  decisionCapsuleIds?: string[];
  decisionTypes?: string[];
}

export interface AuditScrapbookBundle {
  schemaVersion: 'audit_scrapbook.v1';
  npi: string;
  generatedAt: string;
  methodologyVersion: string;
  verifierAgent: string;
  bundleHash: string;
  entries: AuditScrapbookBundleEntry[];
}

function sortStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => (
    left.localeCompare(right)
  ));
}

export function buildAuditScrapbookEntry(
  input: BuildAuditScrapbookEntryInput,
): AuditScrapbookBundleEntry {
  const disclosureFrame = buildSelectiveDisclosurePlaceholder(
    buildCanonicalClaimsFromArtifact({
      npi: input.subjectNpi,
      status: input.status,
      rawPayload: input.sourceResponseArtifact,
    }),
  );

  const decisionCapsuleIds = sortStrings(input.decisionCapsuleIds ?? []);
  const decisionTypes = sortStrings(input.decisionTypes ?? []);
  const verificationMetadata = {
    ...input.verificationMetadata,
    sourceResponseHash: sha256ForPayload(input.sourceResponseArtifact),
    normalizedFactsHash: sha256ForPayload(input.normalizedCredentialFacts),
  };
  const evidenceHash = sha256ForPayload({
    credentialId: input.credentialId,
    verificationArtifactId: input.verificationArtifactId ?? null,
    credentialType: input.credentialType,
    source: input.source,
    sourceResponseArtifact: input.sourceResponseArtifact,
    normalizedCredentialFacts: input.normalizedCredentialFacts,
    verificationMetadata,
    verificationMethod: input.verificationMethod,
    verifiedAt: input.verifiedAt,
    verifierAgent: input.verifierAgent,
    provenanceChain: input.provenanceChain,
    ledgerAnchor: input.ledgerAnchor,
    disclosureFrame,
    decisionCapsuleIds,
    decisionTypes,
  });

  return {
    credentialId: input.credentialId,
    verificationArtifactId: input.verificationArtifactId ?? null,
    credentialType: input.credentialType,
    source: input.source,
    sourceResponseArtifact: input.sourceResponseArtifact,
    normalizedCredentialFacts: input.normalizedCredentialFacts,
    verificationMetadata,
    verificationMethod: input.verificationMethod,
    verifiedAt: input.verifiedAt,
    verifierAgent: input.verifierAgent,
    evidenceHash,
    provenanceChain: input.provenanceChain,
    ledgerAnchor: input.ledgerAnchor,
    disclosureFrame,
    decisionCapsuleIds,
    decisionTypes,
  };
}

export function buildAuditScrapbookBundle(input: {
  npi: string;
  generatedAt: string;
  methodologyVersion: string;
  verifierAgent: string;
  entries: AuditScrapbookBundleEntry[];
}): AuditScrapbookBundle {
  const entries = [...input.entries].sort((left, right) => (
    left.credentialId.localeCompare(right.credentialId)
  ));

  return {
    schemaVersion: 'audit_scrapbook.v1',
    npi: input.npi,
    generatedAt: input.generatedAt,
    methodologyVersion: input.methodologyVersion,
    verifierAgent: input.verifierAgent,
    bundleHash: sha256ForPayload({
      npi: input.npi,
      generatedAt: input.generatedAt,
      methodologyVersion: input.methodologyVersion,
      verifierAgent: input.verifierAgent,
      entries,
    }),
    entries,
  };
}
