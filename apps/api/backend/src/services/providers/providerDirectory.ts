/**
 * providerDirectory.ts — Wave 143: Provider Directory Distribution
 *
 * Generates verified provider directories in multiple export formats:
 *   - generateDirectory()    — in-memory structured directory
 *   - exportFHIRDirectory()  — FHIR R4 Bundle (PractitionerRole)
 *   - exportCSVDirectory()   — CSV export for downstream systems
 *
 * Integrates with Prisma providers, trustRegistry, and credentialWallet.
 */

import prisma from '../../graphql/prisma_client';
import { listIssuers } from '../registry/trustRegistry';
import { listAllCredentials } from '../credentials/credentialWallet';
import type { VerifiableCredential } from '../credentials/credentialModel';
import { isRevoked } from '../revocation/revocationRegistry';
import { log } from '../../obs/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CredentialHealth = 'VERIFIED' | 'EXPIRED' | 'REVOKED' | 'PENDING';

export interface DirectoryEntry {
  npi: string;
  fullName: string;
  specialties: string[];
  credentialCount: number;
  activeCredentials: number;
  primaryIssuer: string | null;
  credentialHealth: CredentialHealth;
  lastVerifiedAt: string | null;
  trustScore: number;
}

export interface ProviderDirectory {
  entries: DirectoryEntry[];
  totalProviders: number;
  verifiedProviders: number;
  exportedAt: string;
  format: 'structured' | 'fhir' | 'csv';
}

export interface FHIRPractitionerRole {
  resourceType: 'PractitionerRole';
  id: string;
  active: boolean;
  practitioner: { reference: string; display: string };
  specialty: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  identifier: Array<{ system: string; value: string }>;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  timestamp: string;
  entry: Array<{ fullUrl: string; resource: FHIRPractitionerRole }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveCredentialHealth(creds: VerifiableCredential[]): CredentialHealth {
  if (creds.length === 0) return 'PENDING';
  const hasRevoked = creds.some((c) => isRevoked(c.credentialId));
  if (hasRevoked) return 'REVOKED';
  const allExpired = creds.every((c) => c.status === 'EXPIRED');
  if (allExpired) return 'EXPIRED';
  return 'VERIFIED';
}

function derivePrimaryIssuer(creds: VerifiableCredential[]): string | null {
  if (creds.length === 0) return null;
  const issuers = listIssuers();
  const issuerMap = new Map(issuers.map((i) => [i.issuerId, i.issuerName]));
  // Most frequently referenced issuer
  const counts = new Map<string, number>();
  for (const c of creds) {
    counts.set(c.issuer, (counts.get(c.issuer) ?? 0) + 1);
  }
  let maxIssuer = creds[0].issuer;
  let maxCount = 0;
  for (const [id, count] of counts) {
    if (count > maxCount) { maxIssuer = id; maxCount = count; }
  }
  return issuerMap.get(maxIssuer) ?? maxIssuer;
}

function deriveTrustScore(creds: VerifiableCredential[]): number {
  if (creds.length === 0) return 0;
  const issuers = listIssuers();
  const scoreMap = new Map(issuers.map((i) => [i.issuerId, i.trustScore ?? 50]));
  const scores = creds
    .filter((c) => c.status === 'ACTIVE' && !isRevoked(c.credentialId))
    .map((c) => scoreMap.get(c.issuer) ?? 50);
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a structured provider directory from all known providers + credentials.
 */
export async function generateDirectory(opts?: {
  limit?: number;
  minTrustScore?: number;
}): Promise<ProviderDirectory> {
  const limit = opts?.limit ?? 500;
  const minTrust = opts?.minTrustScore ?? 0;

  let providers: Array<{ npi: string; fullName: string; taxonomyCode: string }> = [];
  try {
    providers = await prisma.provider.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { npi: true, fullName: true, taxonomyCode: true },
    });
  } catch {
    log('warn', 'directory_provider_fetch_failed', {});
  }

  const allCreds = listAllCredentials();
  const credsBySubject = new Map<string, VerifiableCredential[]>();
  for (const c of allCreds) {
    if (!credsBySubject.has(c.subject)) credsBySubject.set(c.subject, []);
    credsBySubject.get(c.subject)!.push(c);
  }

  const entries: DirectoryEntry[] = [];
  for (const p of providers) {
    const creds = credsBySubject.get(p.npi) ?? [];
    const activeCreds = creds.filter((c) => c.status === 'ACTIVE' && !isRevoked(c.credentialId));
    const trustScore = deriveTrustScore(creds);

    if (trustScore < minTrust) continue;

    const lastVerified = activeCreds.length > 0
      ? activeCreds.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0].issuedAt
      : null;

    entries.push({
      npi: p.npi,
      fullName: p.fullName,
      specialties: p.taxonomyCode ? [p.taxonomyCode] : [],
      credentialCount: creds.length,
      activeCredentials: activeCreds.length,
      primaryIssuer: derivePrimaryIssuer(creds),
      credentialHealth: deriveCredentialHealth(creds),
      lastVerifiedAt: lastVerified,
      trustScore,
    });
  }

  const verified = entries.filter((e) => e.credentialHealth === 'VERIFIED').length;

  log('info', 'directory_generated', { total: entries.length, verified });

  return {
    entries,
    totalProviders: entries.length,
    verifiedProviders: verified,
    exportedAt: new Date().toISOString(),
    format: 'structured',
  };
}

/**
 * Export the provider directory as a FHIR R4 Bundle of PractitionerRole resources.
 */
export async function exportFHIRDirectory(opts?: {
  limit?: number;
}): Promise<FHIRBundle> {
  const dir = await generateDirectory({ limit: opts?.limit });

  const entries = dir.entries.map((e): FHIRBundle['entry'][number] => ({
    fullUrl: `urn:npi:${e.npi}`,
    resource: {
      resourceType: 'PractitionerRole',
      id: `practitioner-role-${e.npi}`,
      active: e.credentialHealth === 'VERIFIED',
      practitioner: {
        reference: `Practitioner/${e.npi}`,
        display: e.fullName,
      },
      specialty: e.specialties.map((s) => ({
        coding: [{
          system: 'http://nucc.org/provider-taxonomy',
          code: s,
          display: s,
        }],
      })),
      identifier: [
        {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: e.npi,
        },
      ],
    },
  }));

  log('info', 'fhir_directory_exported', { count: entries.length });

  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: entries.length,
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}

/**
 * Export the provider directory as CSV text.
 */
export async function exportCSVDirectory(opts?: {
  limit?: number;
  minTrustScore?: number;
}): Promise<string> {
  const dir = await generateDirectory(opts);

  const header = 'NPI,FullName,Specialties,CredentialCount,ActiveCredentials,PrimaryIssuer,CredentialHealth,LastVerifiedAt,TrustScore';
  const rows = dir.entries.map((e) =>
    [
      e.npi,
      `"${e.fullName.replace(/"/g, '""')}"`,
      `"${e.specialties.join('; ')}"`,
      e.credentialCount,
      e.activeCredentials,
      `"${e.primaryIssuer ?? ''}"`,
      e.credentialHealth,
      e.lastVerifiedAt ?? '',
      e.trustScore,
    ].join(','),
  );

  log('info', 'csv_directory_exported', { rows: rows.length });

  return [header, ...rows].join('\n');
}
