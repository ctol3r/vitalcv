/**
 * acceptanceLineageManifest.ts — Acceptance Lineage Manifests
 *
 * Builds a reconstructable, cryptographically-fingerprinted lineage manifest
 * for every production acceptance decision. The manifest records what evidence
 * was present, which criteria passed, which operator signed off, and what
 * scoring version produced the verdict.
 *
 * Manifests are append-only and hash-chained: each manifest references the
 * SHA-256 of its predecessor, producing an auditable acceptance ledger.
 *
 * Design constraints:
 *   - Reconstructable without external lookups: all evidence inline
 *   - Ambiguity explicitly preserved in the manifest record
 *   - Chain integrity verifiable offline
 *   - No PII in the manifest hash chain (PII stays in separate encrypted store)
 */

import { createHash } from 'crypto';
import type { AcceptanceScoringResult, AcceptanceVerdict } from './productionAcceptanceScoring';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ManifestEntryClass =
  | 'INITIAL_ACCEPTANCE'
  | 'RE_ACCEPTANCE'
  | 'CONDITIONAL_RENEWAL'
  | 'REJECTION'
  | 'WITHDRAWAL';

export type LineageSignOffRole =
  | 'SYSTEM_AUTO'
  | 'INSTITUTIONAL_ADMIN'
  | 'COMPLIANCE_OFFICER'
  | 'DEPLOYMENT_OPERATOR';

// ── Input ──────────────────────────────────────────────────────────────────────

export interface AcceptanceLineageEntry {
  entryId: string;
  deploymentId: string;
  institutionId: string;
  entryClass: ManifestEntryClass;
  scoringResult: AcceptanceScoringResult;
  signOffRole: LineageSignOffRole;
  signOffActorId: string;
  priorManifestHash: string | null;   // null for first entry in chain
  ambiguityFlags: string[];
  operationalNotes: string | null;
  entryTimestamp: string;
}

// ── Output ─────────────────────────────────────────────────────────────────────

export interface LineageManifestEntry {
  entryId: string;
  entryClass: ManifestEntryClass;
  deploymentId: string;
  institutionId: string;
  compositeScore: number;
  compositeVerdict: AcceptanceVerdict;
  replaySafe: boolean;
  failClosedEnforced: boolean;
  ambiguityPreserved: boolean;
  ambiguityFlags: string[];
  signOffRole: LineageSignOffRole;
  signOffActorId: string;
  scoringFingerprint: string;
  priorManifestHash: string | null;
  thisManifestHash: string;
  entryTimestamp: string;
}

export interface AcceptanceLineageManifest {
  schema: 'https://vitalcv.com/acceptance-lineage/v1';
  manifestVersion: '1.0';
  deploymentId: string;
  institutionId: string;
  entries: LineageManifestEntry[];
  chainIntact: boolean;
  latestVerdict: AcceptanceVerdict | null;
  latestScore: number | null;
  manifestBuildFingerprint: string;
  builtAt: string;
}

// ── Exported sentinels ─────────────────────────────────────────────────────────

export const LINEAGE_SENTINELS = {
  CHAIN_BREAK_IS_FATAL:       'CHAIN_BREAK_IS_FATAL',
  AMBIGUITY_INLINE:           'AMBIGUITY_INLINE',
  NO_PII_IN_HASH_CHAIN:       'NO_PII_IN_HASH_CHAIN',
  RECONSTRUCTABLE_OFFLINE:    'RECONSTRUCTABLE_OFFLINE',
} as const;

export const KNOWN_ENTRY_CLASSES: ManifestEntryClass[] = [
  'INITIAL_ACCEPTANCE', 'RE_ACCEPTANCE', 'CONDITIONAL_RENEWAL', 'REJECTION', 'WITHDRAWAL',
];

// ── Manifest hash computation ──────────────────────────────────────────────────

function computeEntryHash(
  entry: AcceptanceLineageEntry,
  priorHash: string | null,
): string {
  const hashPayload = {
    entryId:              entry.entryId,
    deploymentId:         entry.deploymentId,
    institutionId:        entry.institutionId,
    entryClass:           entry.entryClass,
    compositeScore:       entry.scoringResult.compositeScore,
    compositeVerdict:     entry.scoringResult.compositeVerdict,
    replaySafe:           entry.scoringResult.replaySafe,
    failClosedEnforced:   entry.scoringResult.failClosedEnforced,
    scoringFingerprint:   entry.scoringResult.scoringFingerprint,
    signOffRole:          entry.signOffRole,
    // signOffActorId deliberately excluded — no identity in hash chain
    ambiguityFlags:       [...entry.ambiguityFlags].sort(),
    priorManifestHash:    priorHash,
    entryTimestamp:       entry.entryTimestamp,
  };
  return createHash('sha256').update(JSON.stringify(hashPayload)).digest('hex');
}

function verifyChainIntegrity(entries: LineageManifestEntry[]): boolean {
  if (entries.length === 0) return true;
  if (entries[0].priorManifestHash !== null) return false;

  for (let i = 1; i < entries.length; i++) {
    if (entries[i].priorManifestHash !== entries[i - 1].thisManifestHash) {
      return false;
    }
  }
  return true;
}

export function buildAcceptanceLineageManifest(
  entries: AcceptanceLineageEntry[],
  builtAt: string,
): AcceptanceLineageManifest {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.entryTimestamp).getTime() - new Date(b.entryTimestamp).getTime(),
  );

  let priorHash: string | null = null;
  const manifestEntries: LineageManifestEntry[] = sorted.map(entry => {
    const thisHash = computeEntryHash(entry, priorHash);
    const manifestEntry: LineageManifestEntry = {
      entryId:             entry.entryId,
      entryClass:          entry.entryClass,
      deploymentId:        entry.deploymentId,
      institutionId:       entry.institutionId,
      compositeScore:      entry.scoringResult.compositeScore,
      compositeVerdict:    entry.scoringResult.compositeVerdict,
      replaySafe:          entry.scoringResult.replaySafe,
      failClosedEnforced:  entry.scoringResult.failClosedEnforced,
      ambiguityPreserved:  entry.scoringResult.ambiguityPreserved,
      ambiguityFlags:      entry.ambiguityFlags,
      signOffRole:         entry.signOffRole,
      signOffActorId:      entry.signOffActorId,
      scoringFingerprint:  entry.scoringResult.scoringFingerprint,
      priorManifestHash:   priorHash,
      thisManifestHash:    thisHash,
      entryTimestamp:      entry.entryTimestamp,
    };
    priorHash = thisHash;
    return manifestEntry;
  });

  const chainIntact = verifyChainIntegrity(manifestEntries);
  const latest      = manifestEntries.at(-1) ?? null;

  const buildPayload = {
    deploymentId:  sorted[0]?.deploymentId ?? '',
    institutionId: sorted[0]?.institutionId ?? '',
    entryIds:      sorted.map(e => e.entryId),
    chainTip:      priorHash,
  };
  const manifestBuildFingerprint =
    createHash('sha256').update(JSON.stringify(buildPayload)).digest('hex');

  return {
    schema: 'https://vitalcv.com/acceptance-lineage/v1',
    manifestVersion: '1.0',
    deploymentId:  sorted[0]?.deploymentId ?? '',
    institutionId: sorted[0]?.institutionId ?? '',
    entries: manifestEntries,
    chainIntact,
    latestVerdict: latest?.compositeVerdict ?? null,
    latestScore:   latest?.compositeScore   ?? null,
    manifestBuildFingerprint,
    builtAt,
  };
}

export function verifyLineageChain(manifest: AcceptanceLineageManifest): {
  intact: boolean;
  brokenAt: number | null;
} {
  const entries = manifest.entries;
  if (entries.length === 0) return { intact: true, brokenAt: null };
  if (entries[0].priorManifestHash !== null) return { intact: false, brokenAt: 0 };

  for (let i = 1; i < entries.length; i++) {
    if (entries[i].priorManifestHash !== entries[i - 1].thisManifestHash) {
      return { intact: false, brokenAt: i };
    }
  }
  return { intact: true, brokenAt: null };
}
