/**
 * Canonical operational language for institutional trust surfaces.
 *
 * Source: archive HTML files (Human Trust Surface, Failure Taxonomy,
 * Institutional Receipt, Trust State Register). Phrases here are the
 * exact, audited words that may appear on institutional surfaces.
 *
 * Companion to `apps/web/lib/trust/status-language.ts`, which governs
 * status labels for the public passport. This module governs the
 * operational copy on institutional surfaces (replay ledger, signed
 * receipt, lineage row, degraded state panels).
 */

export const INSTITUTIONAL_PHRASES = {
  /** Workflow ownership: "the institution, not the individual". */
  institutionOwned: 'Institution-owned workflow',
  /** Replay continuity: head ← prev chain, RFC 3161 anchored. */
  replayableEvidence: 'Replayable evidence',
  /** Live source-of-record was consulted at checked_at. */
  sourceConfirmed: 'Source-confirmed',
  /** An operator manually reviewed and co-signed. */
  humanReviewed: 'Human-reviewed',
  /** Authority via authenticated proxy (employer · admin). */
  delegatedOwnership: 'Delegated ownership',
  /** Chain has a recorded gap. */
  trustInterruption: 'Trust interruption',
  /** Upstream source is slow; receipt records degraded inline. */
  operationalDegradation: 'Operational degradation',
  /** Chain reconciled after a defer. */
  continuityRestored: 'Continuity restored',
  /** No source-of-record fetched yet. */
  evidencePending: 'Evidence pending',
  /** Mode D — affirmative negative. */
  affirmativeNegative: 'No adverse findings',
  /** Existing signed credential remains offline-verifiable. */
  reVerifiableOffline: 'Re-verifiable offline',
  /** σ chain is hash-linked end to end. */
  hashLinkedEndToEnd: 'Hash-linked end to end',
  /** TSA anchor reached. */
  tsaAnchored: 'TSA-anchored',
} as const;

export type InstitutionalPhraseKey = keyof typeof INSTITUTIONAL_PHRASES;

/**
 * Reading-order labels for `LineageHeader`/`LineageRow`. The labels are
 * the canonical names from `Trust Primitives.html` §00 and must never be
 * reworded ("when generated" → "checked_at"; "what surface" → "channel").
 */
export const READING_ORDER_LABELS = {
  object: 'Object',
  ownership: 'Ownership',
  checkedAt: 'checked_at',
  channel: 'Channel',
  replay: 'Replay',
  runId: 'run_id',
} as const;

/**
 * Phrases that are NEVER permitted on an institutional trust surface.
 * Mirrors the project CLAUDE.md truth contract plus archive-specific
 * rejections ("just now", bare "anonymous", "guest" for ownership).
 *
 * The token list is consumed by
 * `apps/web/__tests__/institutional-trust-primitives.test.ts` to guard
 * touched files at CI time. Keep entries lowercase and substring-style.
 */
export const BANNED_INSTITUTIONAL_PHRASES: readonly string[] = [
  // CLAUDE.md truth contract — bans on these are project-wide.
  'automatically verified',
  'guaranteed verification',
  'complete credentialing',
  'instant credentialing',
  'legally accepted',
  'risk transferred',
  'final verification without review',
  'source confirmed before response',
  'certified compliant',
  'hipaa compliant',
  'soc2 certified',
  // Archive-specific rejections (Trust Primitives §04, §07).
  'just now',
  // Mode-D copy must say "no adverse findings", never "no findings".
  // We do not ban "no findings" outright since compound forms exist,
  // but tests check for "no findings" as a bare lane label.
] as const;

/**
 * Returns the lowercased banned tokens that occur in the supplied text.
 * Empty array means the text is clean.
 *
 * Intended for dev-only assertions and CI guards — not user-facing
 * runtime validation.
 */
export function findBannedInstitutionalPhrases(text: string): readonly string[] {
  const lower = text.toLowerCase();
  return BANNED_INSTITUTIONAL_PHRASES.filter((token) => lower.includes(token));
}

/**
 * Canonical ownership labels — Trust Primitives §04. The three fixed
 * values; "anonymous" and "guest" are explicitly banned by the spec.
 */
export const OWNERSHIP_LABELS = {
  subject: 'Subject',
  delegated: 'Delegated',
  unbound: 'Unbound',
} as const;

export type OwnershipState = keyof typeof OWNERSHIP_LABELS;

/**
 * Canonical tier labels — Trust Primitives §03. The four fixed values;
 * "T5" is explicitly banned by the spec.
 */
export const TIER_LABELS = {
  T1: 'T1 · self-attest',
  T2: 'T2 · third-party',
  T3: 'T3 · authoritative',
  T4: 'T4 · issuer-signed',
} as const;

export type TrustTier = keyof typeof TIER_LABELS;
