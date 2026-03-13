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
import { computeClinicianTrustState } from '../trust/trustStateEngine';
import { appendAuditEvent } from '../audit/auditLedger';
import { log } from '../../obs/logger';

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

  // 1. Fetch current trust state
  const trustState = await computeClinicianTrustState(npi);

  // 2. Clinician name from NPPES
  const clinicianName = await resolveClinicianName(npi);

  // 3. Gather VerificationArtifacts
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, lifecycleState: 'active' },
    orderBy: { verifiedAt: 'desc' },
  });

  // 4. Gather CandidateCredentials
  const candidateCredentials = await prisma.candidateCredential.findMany({
    where: { clinicianId: npi },
    orderBy: { createdAt: 'desc' },
  });

  // 5. Build credential list — combine artifact types + candidate types
  const selectiveClaims = options?.selectiveClaims;

  const artifactCredentials: BundleCredential[] = artifacts
    .filter((a) => !selectiveClaims || selectiveClaims.includes(a.source))
    .map((a) => ({
      type: a.source,
      issuer: (a.rawPayload as Record<string, unknown> | null)?.issuer as string ?? 'VitalCV Registry',
      status: a.status,
      verifiedAt: a.verifiedAt?.toISOString() ?? null,
      expiresAt: a.expiresAt?.toISOString() ?? null,
    }));

  const candidateCreds: BundleCredential[] = candidateCredentials
    .filter((c) => {
      if (!selectiveClaims) return true;
      const data = c.data as Record<string, unknown>;
      return selectiveClaims.includes(data?.type as string ?? c.candidateCredentialId);
    })
    .map((c) => {
      const data = c.data as Record<string, unknown>;
      return {
        type: (data?.type as string) ?? 'CANDIDATE_CREDENTIAL',
        issuer: (data?.issuer as string) ?? 'Self-reported',
        status: c.status,
        verifiedAt: (data?.verifiedAt as string) ?? null,
        expiresAt: (data?.expiresAt as string) ?? null,
      };
    });

  const allCredentials = [...artifactCredentials, ...candidateCreds];

  // 6. Gather TrustedIssuers referenced by artifacts
  const issuerNames = new Set<string>();
  for (const a of artifacts) {
    const issuer = (a.rawPayload as Record<string, unknown> | null)?.issuer as string | undefined;
    if (issuer) issuerNames.add(issuer);
  }

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
  const monitoredCount = artifacts.filter((a) => a.monitoring).length;
  let monitoringStatus: 'active' | 'inactive' | 'partial';
  if (artifacts.length === 0) {
    monitoringStatus = 'inactive';
  } else if (monitoredCount === artifacts.length) {
    monitoringStatus = 'active';
  } else if (monitoredCount > 0) {
    monitoringStatus = 'partial';
  } else {
    monitoringStatus = 'inactive';
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
      readiness_level: trustState.readiness_level,
      readiness_score: trustState.readiness_score,
      readiness_status: trustState.readiness_status,
      computed_at: trustState.computed_at,
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
      status: 'active',
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
