/**
 * applyBundle.ts — Wave 246: Apply-with-VitalCV Distribution Wedge
 *
 * Generates a signed, time-limited credential bundle that clinicians can
 * share with employers as a verified trust passport snapshot.
 *
 * Bundle lifecycle:
 *   - Generated on demand (24-hour TTL)
 *   - Stored as a VerificationArtifact with source='APPLY_BUNDLE'
 *   - SHA-256 signature over canonical bundle payload for integrity
 *   - Employer-consumable via public GET endpoint
 */

import { createHash, randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { appendAuditEvent } from '../audit/auditLedger';
import { buildEmployerReviewPayload, type EmployerReviewPayloadV1 } from '../entity/employerReviewPayload';
import { log } from '../../obs/logger';
import { emitLearningEvent } from '../feedback/prismaEventStore';
import { computeAcceptanceAnalysis, type AcceptanceAnalysis } from './acceptanceEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApplyBundleStatus = 'unknown' | 'partial' | 'ready' | 'blocked';
export type ApplyBundleProofTier = 'none' | 'snapshot' | 'partial' | 'decision';

export interface BundleCredential {
  type: string;
  issuer: string;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

export interface IssuerProvenance {
  issuerId: string;
  name: string;
  trustScore: number;
}

export interface ApplyBundleCompleteness {
  verifiedSources: number;
  totalSources: number;
  includedClaims: number;
  missingSources: number;
}

export interface ApplyBundle {
  bundleId: string;
  applicationId?: string;
  entityId?: string | null;
  npi: string;
  clinicianName: string;
  trustState: {
    readiness_level: string;
    readiness_score: number;
    readiness_status: string;
    computed_at: string;
  };
  status: ApplyBundleStatus;
  proofTier: ApplyBundleProofTier;
  snapshotHash: string;
  completeness: ApplyBundleCompleteness;
  blockers: string[];
  nextAction: { id?: string; title: string; detail: string; priority?: string } | null;
  snapshot: {
    sourceCoverage: {
      checks: Array<{ sourceId: string; state: string; reason: string; checkedAt?: string | null }>;
      summary: Record<string, string[]>;
    };
    claims: Array<{
      claimId?: string;
      domain?: string;
      credentialType: string;
      status: string;
      issuer: string;
      observedAt?: string | null;
      expiresAt?: string | null;
    }>;
    freshness: { state: 'current' | 'partial' | 'stale'; label: string; checkedAt: string | null };
    limitations: Array<{
      id?: string;
      state: 'pending' | 'stale' | 'access_required' | 'unavailable' | 'review_required' | 'expired';
      label: string;
      detail: string;
    }>;
    observedAt: string;
  };
  credentials: BundleCredential[];
  issuerProvenance: IssuerProvenance[];
  monitoringStatus: 'active' | 'inactive' | 'partial';
  profileUrl: string;
  generatedAt: string;
  expiresAt: string;
  signature: string;
  acceptanceAnalysis: AcceptanceAnalysis | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSignature(bundle: Omit<ApplyBundle, 'signature'>): string {
  const canonical = JSON.stringify(bundle, Object.keys(bundle).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

// Map CanonicalSourceCoverageState → limitation state
const COVERAGE_TO_LIMITATION: Record<string, ApplyBundle['snapshot']['limitations'][number]['state'] | null> = {
  checked: null,
  stale: 'stale',
  pending: 'pending',
  gated: 'unavailable',
  unavailable: 'unavailable',
  accessRequired: 'access_required',
  reviewRequired: 'review_required',
  notDecisionGrade: 'unavailable',
  previewOnly: 'unavailable',
};

function deriveStatus(payload: EmployerReviewPayloadV1): ApplyBundleStatus {
  // Only explicit adverse evidence triggers 'blocked' — resolvable gaps are 'partial'
  const exclusionStatus = payload.authorityStanding?.exclusionStatus;
  const hasAdverseEvidence =
    exclusionStatus === 'EXCLUDED' ||
    (payload.authorityStanding?.negativeFindings?.length ?? 0) > 0;
  if (hasAdverseEvidence) return 'blocked';

  const checked = payload.sourceCoverage.summary.checked?.length ?? 0;
  if (checked === 0) return 'unknown';

  const unresolved = Object.entries(payload.sourceCoverage.summary)
    .filter(([k]) => k !== 'checked')
    .reduce((sum, [, ids]) => sum + ((ids as string[])?.length ?? 0), 0);
  return unresolved === 0 && payload.readinessSummary.gaps.length === 0 ? 'ready' : 'partial';
}

function deriveProofTier(status: ApplyBundleStatus, level: string, checkedCount: number, claimCount: number): ApplyBundleProofTier {
  if (claimCount === 0) return 'none';
  if (checkedCount === 0) return 'snapshot';
  if (status === 'ready' && level === 'L3') return 'decision';
  return 'partial';
}

function buildSnapshot(payload: EmployerReviewPayloadV1): ApplyBundle['snapshot'] & { rawHash: string } {
  const checks = (payload.sourceCoverage.checks as Array<{ sourceId: string; state: string; reason: string; checkedAt?: string | null }>);
  const summary = payload.sourceCoverage.summary as unknown as Record<string, string[]>;

  const claims = Object.freeze(payload.credentialsIncluded.map((c) => Object.freeze({
    claimId: c.credentialId,
    domain: c.domain,
    credentialType: c.credentialType,
    status: c.status,
    issuer: c.issuerName ?? 'VitalCV Authority',
    observedAt: c.observedAt ?? null,
    expiresAt: c.expiresAt ?? null,
  })));

  const limitations = Object.freeze(checks
    .filter((check) => check.state !== 'checked')
    .map((check) => Object.freeze({
      id: check.sourceId,
      state: COVERAGE_TO_LIMITATION[check.state] ?? 'unavailable',
      label: check.sourceId.replace(/_/g, ' ').toLowerCase(),
      detail: check.reason,
    })));

  const checkedAt = checks.find((c) => c.state === 'checked')?.checkedAt ?? null;
  const staleCount = summary['stale']?.length ?? 0;
  const freshnessState: 'current' | 'partial' | 'stale' =
    staleCount > 0 ? 'stale' : (checkedAt ? 'current' : 'partial');
  const freshnessLabel = freshnessState === 'stale'
    ? 'Some sources are stale'
    : freshnessState === 'current'
      ? 'All sources current'
      : 'Partially checked';

  const rawHash = createHash('sha256')
    .update(JSON.stringify({ sourceCoverage: { checks, summary }, claims, observedAt: payload.checkedAt }))
    .digest('hex');

  return Object.freeze({
    sourceCoverage: Object.freeze({ checks, summary }),
    claims,
    freshness: Object.freeze({ state: freshnessState, label: freshnessLabel, checkedAt }),
    limitations,
    observedAt: payload.checkedAt,
    rawHash,
  });
}

export interface ApplyBundleContract {
  status: ApplyBundleStatus;
  proofTier: ApplyBundleProofTier;
  readinessScore: number | null;
  readinessStatus: string;
  snapshotHash: string;
  completeness: ApplyBundleCompleteness;
  blockers: string[];
  nextAction: ApplyBundle['nextAction'];
  snapshot: ApplyBundle['snapshot'] & { rawHash: string };
  acceptanceAnalysis: AcceptanceAnalysis;
}

export function deriveApplyBundleContract(payload: EmployerReviewPayloadV1): ApplyBundleContract {
  const status = deriveStatus(payload);
  const checkedCount = (payload.sourceCoverage.summary.checked as string[] | undefined)?.length ?? 0;
  const totalSources = (payload.sourceCoverage.sources ?? []).length;
  const completeness: ApplyBundleCompleteness = {
    verifiedSources: checkedCount,
    totalSources,
    includedClaims: payload.credentialsIncluded.length,
    missingSources: Math.max(0, totalSources - checkedCount),
  };
  const proofTier = deriveProofTier(status, payload.readinessSummary.level, checkedCount, payload.credentialsIncluded.length);
  const snapshot = buildSnapshot(payload);
  const snapshotHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  const acceptanceAnalysis = computeAcceptanceAnalysis({ status, proofTier, blockers: payload.blockers, completeness });

  return {
    status,
    proofTier,
    readinessScore: checkedCount === 0 ? null : payload.readinessSummary.readiness_score,
    readinessStatus: checkedCount === 0 ? 'Not yet scored' : payload.readinessSummary.status,
    snapshotHash,
    completeness,
    blockers: payload.blockers,
    nextAction: payload.nextActions[0] ?? null,
    snapshot,
    acceptanceAnalysis,
  };
}

async function resolveClinicianName(npi: string): Promise<string> {
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return `Clinician NPI ${npi}`;
    const data = await res.json() as Record<string, unknown>;
    const results = (data.results as Array<Record<string, unknown>>) ?? [];
    if (results.length === 0) return `Clinician NPI ${npi}`;
    const basic = results[0]?.basic as Record<string, unknown> | undefined;
    if (!basic) return `Clinician NPI ${npi}`;
    const first = (basic.first_name ?? basic.authorized_official_first_name ?? '') as string;
    const last = (basic.last_name ?? basic.authorized_official_last_name ?? '') as string;
    return [first, last].filter(Boolean).join(' ') || `Clinician NPI ${npi}`;
  } catch {
    return `Clinician NPI ${npi}`;
  }
}

// ── Core: generate bundle ─────────────────────────────────────────────────────

export async function generateApplyBundle(
  npi: string,
  options?: { selectiveClaims?: string[] },
): Promise<ApplyBundle> {
  log('info', 'apply_bundle_generate_start', { npi, selectiveClaims: options?.selectiveClaims });

  const subjectEntity = await prisma.vcvEntity.findFirst({
    where: { npi },
    select: { id: true, displayName: true },
  });
  if (!subjectEntity) {
    throw new Error(`No entity found for NPI ${npi}`);
  }

  const reviewPayload = await buildEmployerReviewPayload({
    entityId: subjectEntity.id,
    selectiveDomains: options?.selectiveClaims,
  });

  const clinicianName = reviewPayload.identitySummary.displayName || await resolveClinicianName(npi);

  const allCredentials: BundleCredential[] = reviewPayload.credentialsIncluded.map((credential) => ({
    type: credential.credentialType,
    issuer: credential.issuerName ?? 'VitalCV Authority',
    status: credential.status,
    verifiedAt: credential.observedAt ?? null,
    expiresAt: credential.expiresAt ?? null,
  }));

  const issuerNames = new Set(
    reviewPayload.credentialsIncluded
      .map((credential) => credential.issuerName)
      .filter((issuer): issuer is string => typeof issuer === 'string' && issuer.length > 0),
  );

  const issuers = issuerNames.size > 0
    ? await prisma.trustedIssuer.findMany({
        where: { name: { in: Array.from(issuerNames) } },
        select: { id: true, name: true, trustScore: true },
      })
    : [];

  const issuerProvenance: IssuerProvenance[] = issuers.map((i) => ({
    issuerId: i.id,
    name: i.name,
    trustScore: i.trustScore ?? 0,
  }));

  // 7. Determine monitoring status
  let monitoringStatus: 'active' | 'inactive' | 'partial';
  const checkedSourceCount = reviewPayload.sourceCoverage.summary.checked.length;
  if (checkedSourceCount === 0) {
    monitoringStatus = 'inactive';
  } else if (checkedSourceCount >= 3) {
    monitoringStatus = 'active';
  } else {
    monitoringStatus = 'partial';
  }

  // 8. Assemble bundle (without signature)
  const bundleId = randomUUID();
  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const contract = deriveApplyBundleContract(reviewPayload);
  const { status, proofTier, snapshotHash, completeness, snapshot, acceptanceAnalysis } = contract;

  const bundleWithoutSig: Omit<ApplyBundle, 'signature'> = {
    bundleId,
    entityId: subjectEntity.id,
    npi,
    clinicianName,
    trustState: {
      readiness_level: reviewPayload.readinessSummary.level,
      readiness_score: reviewPayload.readinessSummary.score,
      readiness_status: reviewPayload.readinessSummary.status,
      computed_at: reviewPayload.checkedAt,
    },
    status,
    proofTier,
    snapshotHash,
    completeness,
    blockers: reviewPayload.blockers,
    nextAction: reviewPayload.nextActions[0] ?? null,
    snapshot,
    credentials: allCredentials,
    issuerProvenance,
    monitoringStatus,
    profileUrl: `https://vitalcv.com/p/${npi}`,
    generatedAt,
    expiresAt,
    acceptanceAnalysis,
  };

  const signature = buildSignature(bundleWithoutSig);
  const bundle: ApplyBundle = { ...bundleWithoutSig, signature };

  // 9. Persist as VerificationArtifact (source='APPLY_BUNDLE')
  // Prisma JsonB fields accept any JSON-serialisable object; use `as any` to satisfy
  // the InputJsonValue union which does not accept arbitrary Record<string,unknown>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bundlePayload: any = bundle;
  await prisma.verificationArtifact.create({
    data: {
      id: bundleId,
      npi,
      source: 'APPLY_BUNDLE',
      status: 'ACTIVE',
      rawPayload: bundlePayload,
      checksum: signature,
      verifiedAt: new Date(generatedAt),
      expiresAt: new Date(expiresAt),
      monitoring: false,
      trustState: 'verified',
    },
  });

  // 10. Emit audit event
  appendAuditEvent({
    category: ['BUNDLE_EXPORT'],
    actor: npi,
    resource: bundleId,
    requestFields: { npi, selectiveClaims: options?.selectiveClaims },
    resultFields: { bundleId, credentialCount: allCredentials.length, expiresAt },
    severity: 'INFO',
  });

  // Learning: track snapshot creation (fire-and-forget)
  emitLearningEvent({
    type: 'SNAPSHOT_CREATED',
    providerId: npi,
    metadata: { bundleId, credentialCount: allCredentials.length, monitoringStatus },
    payload: {},
  });

  log('info', 'apply_bundle_generated', { npi, bundleId, credentialCount: allCredentials.length });
  return bundle;
}

// ── Core: verify bundle ───────────────────────────────────────────────────────

export async function verifyBundle(
  bundleId: string,
  signature: string,
): Promise<{ valid: boolean; bundle?: ApplyBundle }> {
  log('info', 'apply_bundle_verify', { bundleId });

  const artifact = await prisma.verificationArtifact.findFirst({
    where: { id: bundleId, source: 'APPLY_BUNDLE' },
  });

  if (!artifact) {
    return { valid: false };
  }

  const bundle = artifact.rawPayload as unknown as ApplyBundle;

  // Check expiration
  if (new Date(bundle.expiresAt) < new Date()) {
    log('info', 'apply_bundle_expired', { bundleId });
    return { valid: false };
  }

  // Verify signature — recompute from stored payload (minus sig)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signature: _sig, ...bundleWithoutSig } = bundle;
  const expectedSig = buildSignature(bundleWithoutSig as Omit<ApplyBundle, 'signature'>);

  if (signature !== expectedSig) {
    log('warn', 'apply_bundle_signature_mismatch', { bundleId });
    return { valid: false };
  }

  return { valid: true, bundle };
}

// ── Core: retrieve bundle by ID ───────────────────────────────────────────────

export async function getApplyBundle(bundleId: string): Promise<ApplyBundle | null> {
  const artifact = await prisma.verificationArtifact.findFirst({
    where: { id: bundleId, source: 'APPLY_BUNDLE' },
  });
  if (!artifact) return null;
  return artifact.rawPayload as unknown as ApplyBundle;
}
