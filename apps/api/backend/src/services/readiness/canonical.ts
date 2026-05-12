/**
 * Canonical readiness engine (P0-P2 of trust-convergence migration).
 *
 * Architectural contract:
 *   - This file is the SINGLE source of truth for the (score, level, band)
 *     triple. Every surface — /api/passport/:npi, /api/passport/:npi/trust,
 *     trust-summary panels, employer evidence packets — derives its
 *     numeric readiness from `derivePassportReadiness` defined here.
 *   - `apps/api/backend/src/services/trust/trustCore.ts` and
 *     `apps/api/backend/src/services/trust/trustStateEngine.ts` must NOT
 *     compute readiness math independently; they call into this module
 *     and translate outputs through `./readinessAdapter`.
 *   - `packages/trust-state` is behavior-frozen legacy compatibility
 *     infrastructure; we depend on its data primitives
 *     (CanonicalSourceCoverage, LAUNCH_SPINE_SOURCE_IDS, ReadinessState)
 *     but never put new authoritative logic there.
 *
 * Semantics:
 *   baseScore   = checkedSpineCount * 25     // 0–100, four launch-spine sources
 *   cappedScore = if any HARD blocker       → 0
 *                if any SOFT/HARD blocker   → min(baseScore, 20)
 *                if any gap                 → min(baseScore, 75)
 *                else                       → baseScore
 *   score       = max(0, cappedScore - divergencePenalty)
 *
 *   level       = if HARD blocker || status==='BLOCKED'     → 'L0'
 *                if score >= 80 && status==='DECISION_GRADE' → 'L3'
 *                if score >= 60                              → 'L2'
 *                if score >  0                               → 'L1'
 *                else                                        → 'L0'
 *
 *   band        = L2|L3 → 'GREEN', L1 → 'YELLOW', L0 → 'RED'
 *
 * The "PECOS not found → L1" behavior that the regex authority in
 * trustCore previously enforced is preserved here structurally:
 * categorizeBlocker tags PECOS messages as SOFT severity, the SOFT cap
 * pins baseScore to 20, and 20 > 0 → L1. The "license expired → L0"
 * behavior is similarly preserved: LICENSURE strings become HARD blockers,
 * HARD severity zeroes the score, and 0 → L0.
 */
import {
  type CanonicalSourceCoverage,
  type LaunchSpineSourceId,
  type ReadinessState,
  LAUNCH_SPINE_SOURCE_IDS,
} from '@vitalcv/trust-state';
import { createHash } from 'node:crypto';

// ── Canonical Blocker primitive ──────────────────────────────────────────────

export type CanonicalBlockerSeverity = 'HARD' | 'SOFT' | 'INFO';

export type CanonicalBlockerCategory =
  | 'IDENTITY'
  | 'LICENSURE'
  | 'EXCLUSION'
  | 'ENROLLMENT'
  | 'DEA'
  | 'BOARD_CERT'
  | 'OTHER';

export interface CanonicalBlocker {
  /** Deterministic id derived from (category, severity, message). */
  id: string;
  message: string;
  severity: CanonicalBlockerSeverity;
  category: CanonicalBlockerCategory;
  sourceId?: string;
  remediation?: string;
}

// ── Categorizer (backward-compat: string blocker → structured) ───────────────

const HARD_LICENSURE_RE = /\b(excluded|license expired|discipline|revoked|suspended)\b/i;
const SOFT_ENROLLMENT_RE = /\b(pecos|enrollment not found)\b/i;
const IDENTITY_RE = /\b(identity|nppes|npi mismatch|name mismatch)\b/i;
const EXCLUSION_RE = /\b(oig|leie|sanction|exclusion)\b/i;
const DEA_RE = /\bdea\b/i;
const BOARD_RE = /\b(board certif|abms|nccpa)\b/i;

function deterministicId(
  category: CanonicalBlockerCategory,
  severity: CanonicalBlockerSeverity,
  message: string,
): string {
  const digest = createHash('sha256')
    .update(`${category}|${severity}|${message.trim().toLowerCase()}`)
    .digest('hex');
  return `blocker_${digest.slice(0, 16)}`;
}

export function categorizeBlocker(message: string): CanonicalBlocker | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  // Order matters: HARD patterns first, then SOFT specifics, then domain-
  // tagged SOFT defaults, then OTHER fallback.
  if (HARD_LICENSURE_RE.test(trimmed)) {
    return { id: deterministicId('LICENSURE', 'HARD', trimmed), message: trimmed, severity: 'HARD', category: 'LICENSURE' };
  }
  if (EXCLUSION_RE.test(trimmed)) {
    return { id: deterministicId('EXCLUSION', 'HARD', trimmed), message: trimmed, severity: 'HARD', category: 'EXCLUSION' };
  }
  if (SOFT_ENROLLMENT_RE.test(trimmed)) {
    return { id: deterministicId('ENROLLMENT', 'SOFT', trimmed), message: trimmed, severity: 'SOFT', category: 'ENROLLMENT' };
  }
  if (IDENTITY_RE.test(trimmed)) {
    return { id: deterministicId('IDENTITY', 'SOFT', trimmed), message: trimmed, severity: 'SOFT', category: 'IDENTITY' };
  }
  if (DEA_RE.test(trimmed)) {
    return { id: deterministicId('DEA', 'SOFT', trimmed), message: trimmed, severity: 'SOFT', category: 'DEA' };
  }
  if (BOARD_RE.test(trimmed)) {
    return { id: deterministicId('BOARD_CERT', 'SOFT', trimmed), message: trimmed, severity: 'SOFT', category: 'BOARD_CERT' };
  }
  return { id: deterministicId('OTHER', 'SOFT', trimmed), message: trimmed, severity: 'SOFT', category: 'OTHER' };
}

export function stringsToBlockers(messages: readonly string[]): CanonicalBlocker[] {
  const out: CanonicalBlocker[] = [];
  for (const m of messages) {
    const b = categorizeBlocker(m);
    if (b) out.push(b);
  }
  return out;
}

export function blockersToStrings(blockers: readonly CanonicalBlocker[]): string[] {
  return blockers.map((b) => b.message);
}

export function dedupeBlockers(blockers: readonly CanonicalBlocker[]): CanonicalBlocker[] {
  const seen = new Set<string>();
  const out: CanonicalBlocker[] = [];
  for (const b of blockers) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

export function hasHardBlocker(blockers: readonly CanonicalBlocker[]): boolean {
  return blockers.some((b) => b.severity === 'HARD');
}

export function hasGatingBlocker(blockers: readonly CanonicalBlocker[]): boolean {
  return blockers.some((b) => b.severity === 'HARD' || b.severity === 'SOFT');
}

// ── Canonical readiness ──────────────────────────────────────────────────────

export type CanonicalTrustLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type CanonicalTrustBand = 'GREEN' | 'YELLOW' | 'RED';

export interface CanonicalReadinessInput {
  sourceCoverage: readonly CanonicalSourceCoverage[];
  blockers: readonly CanonicalBlocker[];
  gaps?: readonly string[];
  divergencePenalty?: number;
  readinessStatus: ReadinessState;
}

export interface CanonicalReadiness {
  score: number;
  level: CanonicalTrustLevel;
  band: CanonicalTrustBand;
  status: ReadinessState;
  blockers: readonly CanonicalBlocker[];
  /** Legacy string[] projection for back-compat callers. */
  blockerStrings: string[];
  gaps: readonly string[];
  checkedSpineCount: number;
}

const LAUNCH_SPINE_SET: ReadonlySet<string> = new Set(LAUNCH_SPINE_SOURCE_IDS);

function countCheckedSpineSources(coverage: readonly CanonicalSourceCoverage[]): number {
  let count = 0;
  for (const c of coverage) {
    if (LAUNCH_SPINE_SET.has(c.sourceId as LaunchSpineSourceId) && c.state === 'checked') {
      count += 1;
    }
  }
  return count;
}

function capByBlockersAndGaps(
  baseScore: number,
  blockers: readonly CanonicalBlocker[],
  hasGap: boolean,
): number {
  if (hasHardBlocker(blockers)) return 0;
  if (hasGatingBlocker(blockers)) return Math.min(baseScore, 20);
  if (hasGap) return Math.min(baseScore, 75);
  return baseScore;
}

export function deriveCanonicalTrustLevel(input: {
  score: number;
  status: ReadinessState;
  blockers: readonly CanonicalBlocker[];
}): CanonicalTrustLevel {
  if (hasHardBlocker(input.blockers) || input.status === 'BLOCKED') return 'L0';
  if (input.score >= 80 && input.status === 'DECISION_GRADE') return 'L3';
  if (input.score >= 60) return 'L2';
  if (input.score > 0) return 'L1';
  return 'L0';
}

export function mapLevelToBand(level: CanonicalTrustLevel): CanonicalTrustBand {
  if (level === 'L2' || level === 'L3') return 'GREEN';
  if (level === 'L1') return 'YELLOW';
  return 'RED';
}

/**
 * THE canonical entry point. All other engines route here.
 */
export function derivePassportReadiness(input: CanonicalReadinessInput): CanonicalReadiness {
  const gaps = input.gaps ?? [];
  const checkedSpineCount = countCheckedSpineSources(input.sourceCoverage);
  const baseScore = checkedSpineCount * 25;
  const capped = capByBlockersAndGaps(baseScore, input.blockers, gaps.length > 0);
  const score = Math.max(0, capped - (input.divergencePenalty ?? 0));
  const level = deriveCanonicalTrustLevel({ score, status: input.readinessStatus, blockers: input.blockers });
  const band = mapLevelToBand(level);

  return {
    score,
    level,
    band,
    status: input.readinessStatus,
    blockers: input.blockers,
    blockerStrings: blockersToStrings(input.blockers),
    gaps,
    checkedSpineCount,
  };
}
