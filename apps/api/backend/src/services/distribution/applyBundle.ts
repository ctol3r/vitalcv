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
import { buildEmployerReviewPayload } from '../entity/employerReviewPayload';
import { log } from '../../obs/logger';
import { emitLearningEvent } from '../feedback/prismaEventStore';

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface ApplyBundle {
  bundleId: string;
  npi: string;
  clinicianName: string;
  trustState: {
    readiness_level: string;
    readiness_score: number;
    readiness_status: string;
    computed_at: string;
  };
  credentials: BundleCredential[];
  issuerProvenance: IssuerProvenance[];
  monitoringStatus: 'active' | 'inactive' | 'partial';
  profileUrl: string;
  generatedAt: string;
  expiresAt: string;
  signature: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSignature(bundle: Omit<ApplyBundle, 'signature'>): string {
  const canonical = JSON.stringify(bundle, Object.keys(bundle).sort());
  return createHash('sha256').update(canonical).digest('hex');
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

  const bundleWithoutSig: Omit<ApplyBundle, 'signature'> = {
    bundleId,
    npi,
    clinicianName,
    trustState: {
      readiness_level: reviewPayload.readinessSummary.level,
      readiness_score: reviewPayload.readinessSummary.score,
      readiness_status: reviewPayload.readinessSummary.status,
      computed_at: reviewPayload.checkedAt,
    },
    credentials: allCredentials,
    issuerProvenance,
    monitoringStatus,
    profileUrl: `https://vitalcv.com/p/${npi}`,
    generatedAt,
    expiresAt,
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
