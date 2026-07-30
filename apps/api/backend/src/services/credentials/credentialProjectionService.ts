import prisma from '../../graphql/prisma_client';

export type CredentialStatus =
  | 'active'
  | 'expired'
  | 'revoked'
  | 'suspended'
  | 'needs_review'
  | 'unknown';

export interface CredentialBase {
  id: string;
  subjectNpi: string;
  credentialType: string;
  issuerId: string | null;
  issuedAt: string | null;
  observedAt: string | null;
  expiresAt: string | null;
  status: CredentialStatus;
  limitations: string[];
}

export interface SourceBackedCredential extends CredentialBase {
  provenance: 'source_backed';
  artifactId: string;
  claimRecordIds: string[];
  receiptIds: string[];
  sourceId: string;
  sourceUrl: string | null;
  trustTier: string | null;
  confidenceScore: number | null;
}

export interface IssuerSignedCredential extends CredentialBase {
  provenance: 'issuer_signed';
  issuedCredentialRecordId: string;
  credentialId: string;
  issuerDid: string;
  holderDid: string;
  format: string;
  kid: string;
  statusReference: string | null;
}

export interface ClinicianProvidedCredential extends CredentialBase {
  provenance: 'self_attested' | 'clinician_approved';
  candidateCredentialId: string;
  profileFieldId: null;
  approvedAt: string;
}

export type Credential =
  | SourceBackedCredential
  | IssuerSignedCredential
  | ClinicianProvidedCredential;

export interface ProjectCredentialsInput {
  npi: string;
  /** Existing CandidateCredential.clinicianId key. Never inferred from the NPI. */
  clinicianId?: string;
}

const NPI_RE = /^\d{10}$/;

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function stringFromJson(value: unknown, keys: readonly string[]): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function statusFromLifecycle(input: {
  status?: string | null;
  trustState?: string | null;
  lifecycleState?: string | null;
  revokedAt?: Date | null;
  suspendedAt?: Date | null;
  expiresAt?: Date | null;
}, now: Date): CredentialStatus {
  if (input.revokedAt) return 'revoked';
  if (input.suspendedAt) return 'suspended';
  if (input.expiresAt && input.expiresAt.getTime() < now.getTime()) return 'expired';

  const tokens = [input.status, input.trustState, input.lifecycleState]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();

  if (tokens.includes('revok')) return 'revoked';
  if (tokens.includes('suspend')) return 'suspended';
  if (tokens.includes('expir')) return 'expired';
  if (tokens.includes('conflict') || tokens.includes('review') || tokens.includes('pending')) {
    return 'needs_review';
  }
  if (tokens.includes('active') || tokens.includes('valid') || tokens.includes('source_backed')) {
    return 'active';
  }
  return 'unknown';
}

function sourceLimitations(
  artifact: {
    trustState: string;
    conflictReason: string | null;
    revokedAt: Date | null;
    suspendedAt: Date | null;
    expiresAt: Date | null;
    claimRecords: Array<{ reviewRequired: boolean; reviewReason: string | null }>;
    verificationReceiptRecords: Array<{ receiptId: string }>;
  },
  status: CredentialStatus,
): string[] {
  const limitations: string[] = [];
  if (artifact.claimRecords.length === 0) {
    limitations.push('No normalized claim records are attached to this source artifact.');
  }
  if (artifact.verificationReceiptRecords.length === 0) {
    limitations.push('No verification receipt record is attached to this source artifact.');
  }
  if (artifact.conflictReason) limitations.push(artifact.conflictReason);
  for (const claim of artifact.claimRecords) {
    if (claim.reviewRequired) {
      limitations.push(claim.reviewReason ?? 'A normalized claim requires human review.');
    }
  }
  if (status !== 'active') {
    limitations.push(`Current credential state is ${status}; no affirmative employer decision is implied.`);
  }
  const trust = artifact.trustState.toLowerCase();
  if (!['source_backed', 'checked', 'active'].some((token) => trust.includes(token))) {
    limitations.push(`Artifact trust state is ${artifact.trustState}.`);
  }
  return [...new Set(limitations)];
}

function provenanceRank(credential: Credential): number {
  switch (credential.provenance) {
    case 'source_backed': return 0;
    case 'issuer_signed': return 1;
    case 'clinician_approved': return 2;
    case 'self_attested': return 3;
  }
}

/**
 * Project the existing evidence stores into one credential API vocabulary while
 * preserving their provenance. This service never promotes self-attested data
 * into source-backed output and never treats an AI draft as a credential.
 */
export async function projectCredentials(
  input: ProjectCredentialsInput,
  now = new Date(),
): Promise<Credential[]> {
  if (!NPI_RE.test(input.npi)) throw new Error('npi must be exactly 10 digits');

  const [artifacts, binding, candidateCredentials] = await Promise.all([
    prisma.verificationArtifact.findMany({
      where: { npi: input.npi },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        npi: true,
        source: true,
        status: true,
        verifiedAt: true,
        expiresAt: true,
        trustState: true,
        lifecycleState: true,
        revokedAt: true,
        suspendedAt: true,
        artifactType: true,
        trustTier: true,
        confidenceScore: true,
        conflictReason: true,
        sourceUrl: true,
        fetchedAt: true,
        observedAt: true,
        claimRecords: {
          select: {
            id: true,
            reviewRequired: true,
            reviewReason: true,
          },
        },
        verificationReceiptRecords: { select: { receiptId: true } },
      },
    }),
    prisma.npiDidBinding.findUnique({ where: { npi: input.npi }, select: { did: true } }),
    input.clinicianId
      ? prisma.candidateCredential.findMany({
          where: { clinicianId: input.clinicianId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, candidateCredentialId: true, data: true, status: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const signed = binding
    ? await prisma.issuedCredentialRecord.findMany({
        where: { holderDid: binding.did },
        orderBy: { issuedAt: 'desc' },
        select: {
          id: true,
          credentialId: true,
          issuerDid: true,
          holderDid: true,
          credentialType: true,
          format: true,
          kid: true,
          statusReference: true,
          issuedAt: true,
          expiresAt: true,
          revokedAt: true,
          status: true,
        },
      })
    : [];

  const projected: Credential[] = [];

  for (const artifact of artifacts) {
    const status = statusFromLifecycle(artifact, now);
    projected.push({
      id: `artifact:${artifact.id}`,
      subjectNpi: artifact.npi,
      credentialType: artifact.artifactType || artifact.source || 'GENERIC',
      issuerId: artifact.source,
      issuedAt: null,
      observedAt: iso(artifact.observedAt ?? artifact.fetchedAt ?? artifact.verifiedAt),
      expiresAt: iso(artifact.expiresAt),
      status,
      limitations: sourceLimitations(artifact, status),
      provenance: 'source_backed',
      artifactId: artifact.id,
      claimRecordIds: artifact.claimRecords.map((claim) => claim.id).sort(),
      receiptIds: artifact.verificationReceiptRecords.map((receipt) => receipt.receiptId).sort(),
      sourceId: artifact.source,
      sourceUrl: artifact.sourceUrl,
      trustTier: artifact.trustTier,
      confidenceScore: artifact.confidenceScore,
    });
  }

  for (const record of signed) {
    const status = statusFromLifecycle(record, now);
    const limitations: string[] = [];
    if (!record.statusReference) limitations.push('No external credential status reference is recorded.');
    if (status !== 'active') limitations.push(`Signed credential state is ${status}.`);
    projected.push({
      id: `issued:${record.id}`,
      subjectNpi: input.npi,
      credentialType: record.credentialType,
      issuerId: record.issuerDid,
      issuedAt: iso(record.issuedAt),
      observedAt: iso(record.issuedAt),
      expiresAt: iso(record.expiresAt),
      status,
      limitations,
      provenance: 'issuer_signed',
      issuedCredentialRecordId: record.id,
      credentialId: record.credentialId,
      issuerDid: record.issuerDid,
      holderDid: record.holderDid,
      format: record.format,
      kid: record.kid,
      statusReference: record.statusReference,
    });
  }

  for (const candidate of candidateCredentials) {
    const credentialType = stringFromJson(candidate.data, ['credentialType', 'type', 'kind'])
      ?? 'CANDIDATE_CREDENTIAL';
    const declaredNpi = stringFromJson(candidate.data, ['npi', 'subjectNpi']);
    const provenance = stringFromJson(candidate.data, ['provenance']) === 'clinician_approved'
      ? 'clinician_approved'
      : 'self_attested';
    projected.push({
      id: `candidate:${candidate.id}`,
      subjectNpi: declaredNpi && NPI_RE.test(declaredNpi) ? declaredNpi : input.npi,
      credentialType,
      issuerId: null,
      issuedAt: null,
      observedAt: iso(candidate.createdAt),
      expiresAt: null,
      status: 'needs_review',
      limitations: [
        'Clinician-provided record; not primary-source-verified.',
        candidate.status ? `Candidate record status is ${candidate.status}.` : 'Candidate record status is unknown.',
      ],
      provenance,
      candidateCredentialId: candidate.candidateCredentialId,
      profileFieldId: null,
      approvedAt: candidate.createdAt.toISOString(),
    });
  }

  projected.sort((a, b) => (
    provenanceRank(a) - provenanceRank(b)
    || a.credentialType.localeCompare(b.credentialType)
    || a.id.localeCompare(b.id)
  ));
  return projected;
}
