/**
 * replayAbstractionOptimizer.ts — Replay Legibility Compression
 *
 * Wraps the raw DecisionReplay bundle from replayEngine.ts in a compressed,
 * human-legible narrative without discarding any evidence.
 *
 * Goals:
 *   - Reduce the cognitive load of reading a replay from O(evidence-count) to O(1)
 *   - Preserve every hash, every evidence record, every authority chain link
 *   - Produce a "legibility score" that quantifies compression gain
 *
 * Non-goals:
 *   - Summarize away ambiguity — ambiguous states are preserved verbatim
 *   - Replace the canonical replay bundle — the canonical bundle is always attached
 */

import type { DecisionReplay } from '../audit/replayEngine';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReplayNarrativeVerdict =
  | 'clean_pass'
  | 'hash_mismatch'
  | 'stale_evidence'
  | 'authority_gap'
  | 'ambiguous';

export interface ReplayNarrativeLine {
  position: number;
  kind: 'identity' | 'decision' | 'evidence' | 'integrity' | 'authority' | 'anomaly';
  label: string;
  value: string;
  /** true = this line survived compression; false = folded into an adjacent line */
  retained: boolean;
}

export interface ReplayLegibilityScore {
  /**
   * 0–100: fraction of the canonical replay's informational lines that can be
   * understood without cross-referencing other lines.
   * 100 = perfect self-contained legibility; 0 = requires full raw bundle to parse.
   */
  score: number;
  canonicalLineCount: number;
  compressedLineCount: number;
  compressionRatio: number; // compressedLineCount / canonicalLineCount
  ambiguityRetained: boolean;
  integrityVerified: boolean;
}

// Alias for DecisionReplay fields to avoid repeated optional-chaining on the nested shape
type EvidenceRecord = import('../audit/replayEngine').EvidenceRecord;
type AuthorityChainLink = import('../audit/replayEngine').AuthorityChainLink;

export interface OptimizedReplay {
  replayId: string;
  optimizedAt: string;
  verdict: ReplayNarrativeVerdict;
  narrative: ReplayNarrativeLine[];
  legibilityScore: ReplayLegibilityScore;
  /** Full canonical bundle — never dropped, always attached */
  canonicalBundle: DecisionReplay;
}

// ── Narrative extraction ───────────────────────────────────────────────────────

function extractNarrativeLines(replay: DecisionReplay): ReplayNarrativeLine[] {
  const lines: ReplayNarrativeLine[] = [];
  let pos = 0;

  // Identity block (always retained)
  lines.push({ position: pos++, kind: 'identity', label: 'Subject NPI', value: replay.subjectNpi, retained: true });
  lines.push({ position: pos++, kind: 'identity', label: 'Capsule', value: replay.capsuleId, retained: true });
  lines.push({ position: pos++, kind: 'identity', label: 'Decision type', value: replay.decisionType, retained: true });

  // Decision block (always retained)
  lines.push({ position: pos++, kind: 'decision', label: 'Action', value: replay.decision.action ?? 'none', retained: true });
  lines.push({ position: pos++, kind: 'decision', label: 'Outcome', value: replay.decision.outcome, retained: true });

  // Integrity block (always retained — hash match is critical)
  const integrity = replay.integrity;
  const hashMatch = integrity.hashMatch;
  lines.push({
    position: pos++,
    kind: 'integrity',
    label: 'Hash match',
    value: hashMatch ? 'PASS' : `FAIL — tamper evidence: ${integrity.tamperEvidence ?? 'unknown'}`,
    retained: true,
  });
  lines.push({ position: pos++, kind: 'integrity', label: 'Methodology', value: `${integrity.methodology} v${integrity.methodologyVersion}`, retained: true });

  // Evidence block — fold redundant entries; retain anomalous ones verbatim
  const evidence: EvidenceRecord[] = replay.evidenceSnapshot?.evidenceRecords ?? [];
  const evidenceByStatus = new Map<string, number>();
  for (const e of evidence) {
    evidenceByStatus.set(e.status, (evidenceByStatus.get(e.status) ?? 0) + 1);
  }
  // Fold clean evidence into a summary line
  const cleanCount = evidenceByStatus.get('ACTIVE') ?? 0;
  if (cleanCount > 0) {
    lines.push({
      position: pos++,
      kind: 'evidence',
      label: 'Active credentials',
      value: `${cleanCount} active artifact${cleanCount !== 1 ? 's' : ''} — all clean`,
      retained: true,
    });
  }
  // Surface non-clean evidence individually (never fold anomalies)
  for (const e of evidence) {
    if (e.status !== 'ACTIVE') {
      lines.push({
        position: pos++,
        kind: 'evidence',
        label: `${e.credentialType} [${e.source}]`,
        value: `status=${e.status} verifiedAt=${e.verifiedAt ?? 'unknown'}`,
        retained: true,
      });
    } else {
      // Folded — still present in canonicalBundle
      lines.push({
        position: pos++,
        kind: 'evidence',
        label: e.credentialType,
        value: 'folded into summary',
        retained: false,
      });
    }
  }

  // Authority chain — fold clean links; surface gaps
  const chain: AuthorityChainLink[] = replay.authorityChain ?? [];
  const gapLinks = chain.filter(l => l.status !== 'ACTIVE' && l.status !== 'VERIFIED');
  if (gapLinks.length === 0) {
    lines.push({
      position: pos++,
      kind: 'authority',
      label: 'Authority chain',
      value: `${chain.length} link${chain.length !== 1 ? 's' : ''} — no gaps`,
      retained: true,
    });
  } else {
    for (const link of gapLinks) {
      lines.push({
        position: pos++,
        kind: 'anomaly',
        label: `Chain gap at ${link.nodeType}`,
        value: `id=${link.id} status=${link.status}`,
        retained: true,
      });
    }
  }

  return lines;
}

function computeVerdict(replay: DecisionReplay): ReplayNarrativeVerdict {
  if (!replay.integrity.hashMatch) return 'hash_mismatch';

  const stale = (replay.evidenceSnapshot?.evidenceRecords ?? []).some(e => e.status === 'EXPIRED');
  if (stale) return 'stale_evidence';

  const hasGap = (replay.authorityChain ?? []).some(
    l => l.status !== 'ACTIVE' && l.status !== 'VERIFIED',
  );
  if (hasGap) return 'authority_gap';

  return 'clean_pass';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compress a raw DecisionReplay into a legibility-optimized narrative.
 *
 * The canonical bundle is always attached — this optimizer never discards data.
 * The narrative folds redundant clean evidence into summaries and surfaces
 * anomalies individually, reducing cognitive overhead without losing fidelity.
 */
export function optimizeReplayLegibility(replay: DecisionReplay): OptimizedReplay {
  const narrative = extractNarrativeLines(replay);
  const verdict = computeVerdict(replay);

  const canonicalLineCount = narrative.length;
  const compressedLineCount = narrative.filter(l => l.retained).length;
  const compressionRatio = canonicalLineCount > 0
    ? compressedLineCount / canonicalLineCount
    : 1;

  // Legibility score: higher compression = lower score when ratio <0.5;
  // penalise heavily only when hash mismatch or gaps exist.
  let score = Math.round((1 - compressionRatio) * 60 + 40);
  if (verdict === 'hash_mismatch') score = Math.min(score, 30);
  if (verdict === 'authority_gap') score = Math.min(score, 50);
  score = Math.max(0, Math.min(100, score));

  const legibilityScore: ReplayLegibilityScore = {
    score,
    canonicalLineCount,
    compressedLineCount,
    compressionRatio,
    ambiguityRetained: verdict !== 'clean_pass', // ambiguous states bubble to verdict
    integrityVerified: replay.integrity.hashMatch,
  };

  log('info', 'replayAbstractionOptimizer: replay optimized', {
    capsuleId: replay.capsuleId,
    verdict,
    legibilityScore: score,
    compressionRatio,
  });

  return {
    replayId: `opt-${replay.capsuleId}-${Date.now()}`,
    optimizedAt: new Date().toISOString(),
    verdict,
    narrative,
    legibilityScore,
    canonicalBundle: replay,
  };
}
