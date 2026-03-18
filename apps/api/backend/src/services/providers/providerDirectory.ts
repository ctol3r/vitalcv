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
import { log } from '../../obs/logger';
import { listAllCredentials } from '../credentials/credentialWallet';
import type { VerifiableCredential } from '../credentials/credentialModel';
import {
  initializeTrustRegistryPersistence,
  listIssuers,
  type TrustedIssuer,
} from '../registry/trustRegistry';
import { isRevoked } from '../revocation/revocationRegistry';
import { sha256ForPayload, sha256Hex } from '../../utils/deterministic';

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

export interface DirectoryPageInfo {
  page: number;
  pageSize: number;
  returned: number;
  totalAvailable: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface ProviderDirectory {
  entries: DirectoryEntry[];
  totalProviders: number;
  verifiedProviders: number;
  exportedAt: string;
  format: 'structured' | 'fhir' | 'csv';
  pageInfo: DirectoryPageInfo;
  integrityHash: string;
}

export interface FHIRPractitionerRole {
  resourceType: 'PractitionerRole';
  id: string;
  active: boolean;
  practitioner: { reference: string; display: string };
  organization: { reference: string; display: string };
  code: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  specialty: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  identifier: Array<{ system: string; value: string }>;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  timestamp: string;
  entry: Array<{ fullUrl: string; resource: FHIRPractitionerRole }>;
  pageInfo: DirectoryPageInfo;
  integrityHash: string;
  link: Array<{ relation: string; url: string }>;
}

export interface CSVDirectoryExport {
  content: string;
  integrityHash: string;
  pageInfo: DirectoryPageInfo;
}

export interface DirectoryQueryOptions {
  limit?: number;
  page?: number;
  pageSize?: number;
  minTrustScore?: number;
}

interface ProviderDirectoryRow {
  npi: string;
  fullName: string;
  taxonomyCode: string;
  stateOfPractice: string;
}

interface NormalizedDirectoryQueryOptions {
  page: number;
  pageSize: number;
  minTrustScore: number;
}

interface DirectoryPageResult {
  entries: DirectoryEntry[];
  pageInfo: DirectoryPageInfo;
  verifiedProviders: number;
  exportedAt: string;
  minTrustScore: number;
}

const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 1000;
const DIRECTORY_ORGANIZATION_REFERENCE = 'Organization/vitalcv-provider-directory';
const DIRECTORY_ORGANIZATION_DISPLAY = 'VitalCV Provider Directory';
const NUCC_TAXONOMY_SYSTEM = 'http://nucc.org/provider-taxonomy';
const NPI_SYSTEM = 'http://hl7.org/fhir/sid/us-npi';

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  return normalized >= 1 ? normalized : fallback;
}

function normalizeDirectoryOptions(opts?: DirectoryQueryOptions): NormalizedDirectoryQueryOptions {
  const page = normalizePositiveInteger(opts?.page, 1);
  const requestedPageSize = normalizePositiveInteger(
    opts?.pageSize ?? opts?.limit,
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  const minTrustScore = typeof opts?.minTrustScore === 'number' && Number.isFinite(opts.minTrustScore)
    ? Math.max(0, Math.min(100, Math.floor(opts.minTrustScore)))
    : 0;

  return {
    page,
    pageSize,
    minTrustScore,
  };
}

function isCredentialExpired(credential: VerifiableCredential, now = Date.now()): boolean {
  if (credential.status === 'EXPIRED') {
    return true;
  }

  if (!credential.expiresAt) {
    return false;
  }

  const expiresAt = new Date(credential.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function sortCredentials(credentials: readonly VerifiableCredential[]): VerifiableCredential[] {
  return [...credentials].sort((left, right) => left.credentialId.localeCompare(right.credentialId));
}

function groupCredentialsBySubject(): Map<string, VerifiableCredential[]> {
  const grouped = new Map<string, VerifiableCredential[]>();

  for (const credential of listAllCredentials()) {
    const existing = grouped.get(credential.subject);
    if (existing) {
      existing.push(credential);
      continue;
    }

    grouped.set(credential.subject, [credential]);
  }

  for (const [subject, credentials] of grouped) {
    grouped.set(subject, sortCredentials(credentials));
  }

  return grouped;
}

function buildIssuerMaps(): {
  issuerNameById: Map<string, string>;
  issuerScoreById: Map<string, number>;
} {
  const issuers = listIssuers();
  return {
    issuerNameById: new Map(issuers.map((issuer) => [issuer.issuerId, issuer.issuerName])),
    issuerScoreById: new Map(issuers.map((issuer) => [issuer.issuerId, issuer.trustScore ?? 50])),
  };
}

function getActiveCredentials(credentials: readonly VerifiableCredential[], now = Date.now()): VerifiableCredential[] {
  return credentials.filter((credential) =>
    credential.status === 'ACTIVE' &&
    !isRevoked(credential.credentialId) &&
    !isCredentialExpired(credential, now),
  );
}

function deriveCredentialHealth(credentials: readonly VerifiableCredential[], now = Date.now()): CredentialHealth {
  if (credentials.length === 0) {
    return 'PENDING';
  }

  if (credentials.some((credential) =>
    credential.status === 'REVOKED' || isRevoked(credential.credentialId),
  )) {
    return 'REVOKED';
  }

  if (credentials.every((credential) => isCredentialExpired(credential, now))) {
    return 'EXPIRED';
  }

  return 'VERIFIED';
}

function derivePrimaryIssuer(
  credentials: readonly VerifiableCredential[],
  issuerNameById: ReadonlyMap<string, string>,
): string | null {
  if (credentials.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const credential of credentials) {
    counts.set(credential.issuer, (counts.get(credential.issuer) ?? 0) + 1);
  }

  const [primaryIssuerId] = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })[0];

  return issuerNameById.get(primaryIssuerId) ?? primaryIssuerId;
}

/**
 * Credential-issuer-based trust: average of issuer scores for active credentials.
 * Findings-based trust adjustments (e.g. trustImpact from the investigator engine)
 * are handled separately via the copilot context service and investigation workbench.
 */
function deriveTrustScore(
  credentials: readonly VerifiableCredential[],
  issuerScoreById: ReadonlyMap<string, number>,
  now = Date.now(),
): number {
  const activeCredentials = getActiveCredentials(credentials, now);
  if (activeCredentials.length === 0) {
    return 0;
  }

  const scores = activeCredentials.map((credential) => issuerScoreById.get(credential.issuer) ?? 50);
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function deriveLastVerifiedAt(credentials: readonly VerifiableCredential[], now = Date.now()): string | null {
  const activeCredentials = getActiveCredentials(credentials, now);
  if (activeCredentials.length === 0) {
    return null;
  }

  return [...activeCredentials]
    .sort((left, right) => {
      const issuedAtComparison = right.issuedAt.localeCompare(left.issuedAt);
      if (issuedAtComparison !== 0) {
        return issuedAtComparison;
      }

      return left.credentialId.localeCompare(right.credentialId);
    })[0]
    .issuedAt;
}

function buildPageInfo(params: {
  page: number;
  pageSize: number;
  returned: number;
  totalAvailable: number;
}): DirectoryPageInfo {
  const totalPages = params.totalAvailable === 0
    ? 0
    : Math.ceil(params.totalAvailable / params.pageSize);

  return {
    page: params.page,
    pageSize: params.pageSize,
    returned: params.returned,
    totalAvailable: params.totalAvailable,
    totalPages,
    hasNextPage: params.page * params.pageSize < params.totalAvailable,
  };
}

function buildDirectoryLinks(basePath: string, pageInfo: DirectoryPageInfo, minTrustScore: number) {
  const buildUrl = (page: number): string => {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageInfo.pageSize),
    });
    if (minTrustScore > 0) {
      query.set('minTrustScore', String(minTrustScore));
    }
    return `${basePath}?${query.toString()}`;
  };

  const links: FHIRBundle['link'] = [
    { relation: 'self', url: buildUrl(pageInfo.page) },
  ];

  if (pageInfo.page > 1) {
    links.push({ relation: 'prev', url: buildUrl(pageInfo.page - 1) });
  }

  if (pageInfo.hasNextPage) {
    links.push({ relation: 'next', url: buildUrl(pageInfo.page + 1) });
  }

  return links;
}

async function fetchProviderRows(): Promise<ProviderDirectoryRow[]> {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { npi: 'asc' },
      select: {
        npi: true,
        fullName: true,
        taxonomyCode: true,
        stateOfPractice: true,
      },
    });

    return [...providers].sort((left, right) => left.npi.localeCompare(right.npi));
  } catch {
    log('warn', 'directory_provider_fetch_failed', {});
    return [];
  }
}

async function buildDirectoryPage(opts?: DirectoryQueryOptions): Promise<DirectoryPageResult> {
  await initializeTrustRegistryPersistence();

  const normalized = normalizeDirectoryOptions(opts);
  const providers = await fetchProviderRows();
  const credentialsBySubject = groupCredentialsBySubject();
  const { issuerNameById, issuerScoreById } = buildIssuerMaps();
  const now = Date.now();

  const filteredEntries = providers
    .map((provider): DirectoryEntry => {
      const credentials = credentialsBySubject.get(provider.npi) ?? [];
      const activeCredentials = getActiveCredentials(credentials, now);
      const trustScore = deriveTrustScore(credentials, issuerScoreById, now);

      return {
        npi: provider.npi,
        fullName: provider.fullName,
        specialties: provider.taxonomyCode ? [provider.taxonomyCode] : [],
        credentialCount: credentials.length,
        activeCredentials: activeCredentials.length,
        primaryIssuer: derivePrimaryIssuer(
          activeCredentials.length > 0 ? activeCredentials : credentials,
          issuerNameById,
        ),
        credentialHealth: deriveCredentialHealth(credentials, now),
        lastVerifiedAt: deriveLastVerifiedAt(credentials, now),
        trustScore,
      };
    })
    .filter((entry) => entry.trustScore >= normalized.minTrustScore)
    .sort((left, right) => left.npi.localeCompare(right.npi));

  const startIndex = (normalized.page - 1) * normalized.pageSize;
  const pagedEntries = filteredEntries.slice(startIndex, startIndex + normalized.pageSize);
  const pageInfo = buildPageInfo({
    page: normalized.page,
    pageSize: normalized.pageSize,
    returned: pagedEntries.length,
    totalAvailable: filteredEntries.length,
  });

  return {
    entries: pagedEntries,
    pageInfo,
    verifiedProviders: pagedEntries.filter((entry) => entry.credentialHealth === 'VERIFIED').length,
    exportedAt: new Date().toISOString(),
    minTrustScore: normalized.minTrustScore,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a structured provider directory from all known providers + credentials.
 */
export async function generateDirectory(opts?: DirectoryQueryOptions): Promise<ProviderDirectory> {
  const page = await buildDirectoryPage(opts);

  const payload = {
    entries: page.entries,
    totalProviders: page.entries.length,
    verifiedProviders: page.verifiedProviders,
    exportedAt: page.exportedAt,
    format: 'structured' as const,
    pageInfo: page.pageInfo,
  };
  const integrityHash = sha256ForPayload(payload);

  log('info', 'directory_generated', {
    returned: payload.totalProviders,
    verified: payload.verifiedProviders,
    page: page.pageInfo.page,
    pageSize: page.pageInfo.pageSize,
    totalAvailable: page.pageInfo.totalAvailable,
    integrityHash,
  });

  return {
    ...payload,
    integrityHash,
  };
}

/**
 * Export the provider directory as a FHIR R4 Bundle of PractitionerRole resources.
 */
export async function exportFHIRDirectory(opts?: DirectoryQueryOptions): Promise<FHIRBundle> {
  const page = await buildDirectoryPage(opts);

  const entry = page.entries.map((directoryEntry): FHIRBundle['entry'][number] => {
    const taxonomyCoding = directoryEntry.specialties.map((specialty) => ({
      system: NUCC_TAXONOMY_SYSTEM,
      code: specialty,
      display: specialty,
    }));

    return {
      fullUrl: `urn:npi:${directoryEntry.npi}`,
      resource: {
        resourceType: 'PractitionerRole',
        id: `practitioner-role-${directoryEntry.npi}`,
        active: directoryEntry.credentialHealth === 'VERIFIED',
        practitioner: {
          reference: `Practitioner/${directoryEntry.npi}`,
          display: directoryEntry.fullName,
        },
        organization: {
          reference: DIRECTORY_ORGANIZATION_REFERENCE,
          display: DIRECTORY_ORGANIZATION_DISPLAY,
        },
        code: taxonomyCoding.map((coding) => ({ coding: [coding] })),
        specialty: taxonomyCoding.map((coding) => ({ coding: [coding] })),
        identifier: [
          {
            system: NPI_SYSTEM,
            value: directoryEntry.npi,
          },
        ],
      },
    };
  });

  const payload = {
    resourceType: 'Bundle' as const,
    type: 'searchset' as const,
    total: entry.length,
    timestamp: page.exportedAt,
    entry,
    pageInfo: page.pageInfo,
    link: buildDirectoryLinks('/api/directory/fhir', page.pageInfo, page.minTrustScore),
  };
  const integrityHash = sha256ForPayload(payload);

  log('info', 'fhir_directory_exported', {
    count: entry.length,
    page: page.pageInfo.page,
    pageSize: page.pageInfo.pageSize,
    totalAvailable: page.pageInfo.totalAvailable,
    integrityHash,
  });

  return {
    ...payload,
    integrityHash,
  };
}

/**
 * Export the provider directory as CSV text.
 */
export async function exportCSVDirectory(opts?: DirectoryQueryOptions): Promise<CSVDirectoryExport> {
  const page = await buildDirectoryPage(opts);

  const header = 'NPI,FullName,Specialties,CredentialCount,ActiveCredentials,PrimaryIssuer,CredentialHealth,LastVerifiedAt,TrustScore';
  const rows = page.entries.map((entry) =>
    [
      entry.npi,
      `"${entry.fullName.replace(/"/g, '""')}"`,
      `"${entry.specialties.join('; ')}"`,
      entry.credentialCount,
      entry.activeCredentials,
      `"${entry.primaryIssuer ?? ''}"`,
      entry.credentialHealth,
      entry.lastVerifiedAt ?? '',
      entry.trustScore,
    ].join(','),
  );
  const content = [header, ...rows].join('\n');
  const integrityHash = sha256Hex(content);

  log('info', 'csv_directory_exported', {
    rows: rows.length,
    page: page.pageInfo.page,
    pageSize: page.pageInfo.pageSize,
    totalAvailable: page.pageInfo.totalAvailable,
    integrityHash,
  });

  return {
    content,
    integrityHash,
    pageInfo: page.pageInfo,
  };
}

// ── Wave 149: Directory Network Distribution ─────────────────────────────────

/** In-memory snapshot store */
interface DirectorySnapshot {
  id: string;
  hash: string;
  providerCount: number;
  verifiedCount: number;
  publishedAt: string;
  publishedBy: string;
  entries: DirectoryEntry[];
}

const snapshotStore = new Map<string, DirectorySnapshot>();
let snapshotCounter = 0;

/**
 * Publish a point-in-time directory snapshot with integrity hash.
 * Returns the snapshot ID + hash for federation distribution.
 */
export async function publishDirectorySnapshot(
  publishedBy = 'system',
  opts?: DirectoryQueryOptions,
): Promise<{ snapshotId: string; hash: string; providerCount: number; publishedAt: string }> {
  const dir = await generateDirectory(opts);
  const payload = JSON.stringify(dir.entries.map((e) => ({ npi: e.npi, fullName: e.fullName, health: e.credentialHealth, trust: e.trustScore })));
  const hash = sha256Hex(payload);

  snapshotCounter++;
  const snapshotId = `snap-${Date.now()}-${snapshotCounter}`;
  const snapshot: DirectorySnapshot = {
    id: snapshotId,
    hash,
    providerCount: dir.totalProviders,
    verifiedCount: dir.verifiedProviders,
    publishedAt: new Date().toISOString(),
    publishedBy,
    entries: dir.entries,
  };

  snapshotStore.set(snapshotId, snapshot);

  log('info', 'directory_snapshot_published', {
    snapshotId,
    hash,
    providerCount: dir.totalProviders,
  });

  return {
    snapshotId,
    hash,
    providerCount: dir.totalProviders,
    publishedAt: snapshot.publishedAt,
  };
}

/**
 * Retrieve a published directory snapshot by ID.
 */
export function getDirectorySnapshot(snapshotId: string): DirectorySnapshot | null {
  return snapshotStore.get(snapshotId) ?? null;
}

/**
 * List all published snapshots (metadata only, no entries).
 */
export function listDirectorySnapshots(): Array<Omit<DirectorySnapshot, 'entries'>> {
  return Array.from(snapshotStore.values()).map(({ entries: _entries, ...meta }) => meta);
}

/**
 * Verify the integrity of a directory snapshot.
 * Recomputes the hash and compares with stored value.
 */
export function verifyDirectoryIntegrity(snapshotId: string): {
  snapshotId: string;
  valid: boolean;
  storedHash: string;
  computedHash: string;
  verifiedAt: string;
} | null {
  const snapshot = snapshotStore.get(snapshotId);
  if (!snapshot) return null;

  const payload = JSON.stringify(snapshot.entries.map((e) => ({ npi: e.npi, fullName: e.fullName, health: e.credentialHealth, trust: e.trustScore })));
  const computedHash = sha256Hex(payload);

  return {
    snapshotId,
    valid: computedHash === snapshot.hash,
    storedHash: snapshot.hash,
    computedHash,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Generate a signed directory payload suitable for federation distribution.
 * Returns a JSON envelope with hash, metadata, and entries.
 */
export async function generateSignedDirectory(
  opts?: DirectoryQueryOptions,
): Promise<{
  version: '1.0';
  issuer: string;
  hash: string;
  providerCount: number;
  verifiedCount: number;
  generatedAt: string;
  entries: DirectoryEntry[];
}> {
  const dir = await generateDirectory(opts);
  const payload = JSON.stringify(dir.entries.map((e) => ({ npi: e.npi, fullName: e.fullName, health: e.credentialHealth, trust: e.trustScore })));
  const hash = sha256Hex(payload);

  return {
    version: '1.0',
    issuer: 'did:vitalcv:directory',
    hash,
    providerCount: dir.totalProviders,
    verifiedCount: dir.verifiedProviders,
    generatedAt: new Date().toISOString(),
    entries: dir.entries,
  };
}
