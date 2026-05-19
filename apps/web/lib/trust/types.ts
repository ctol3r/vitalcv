/**
 * VitalCV · Trust Surfaces · Type Canon v1
 *
 * Types that match the binding reading order documented in
 * docs/design/claude-design-handoff-2026-05-18/. Every trust surface
 * renders lineage cells in this exact order:
 *
 *   OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
 *
 * The order is encoded in `LINEAGE_READING_ORDER` so tests can assert
 * it directly. Components must consume that array — never hand-roll
 * a different sequence.
 *
 * No live source claims live in these types. Every value is a
 * fixture/demo string by default; production routes that ever wire
 * to a real source must add their own runtime guards.
 */

/** Trust-surface visual state. */
export type TrustState = 'preview' | 'snapshot' | 'signed';

/**
 * Ownership state of the subject of a trust assertion.
 *
 * `subject`   — the asserting party is the subject (a clinician
 *               viewing their own record).
 * `delegated` — an operator / verifier is reading on behalf of the
 *               subject under a documented delegation.
 * `unbound`   — no subject binding has been established yet (the
 *               surface is a preview or anonymous probe).
 *
 * The brief forbids implicit ownership — every trust surface must
 * render one of these three values explicitly. There is no fourth
 * "default" option.
 */
export type OwnershipState = 'subject' | 'delegated' | 'unbound';

/** Replay-memory state for the assertion. */
export type ReplayState =
  | 'anchored'
  | 'pending'
  | 'unanchored'
  | 'mismatched';

/** Failure modes A–E from the design canon. */
export type FailureMode = 'A' | 'B' | 'C' | 'D' | 'E';

/** Degraded-row reason (rendered with dashed border, never opacity). */
export type DegradedReason =
  | 'stale'
  | 'access_required'
  | 'review_required'
  | 'unavailable'
  | 'gated';

/**
 * Lineage cells — the binding reading order.
 *
 * Component renderers MUST iterate `LINEAGE_READING_ORDER` rather
 * than `Object.keys(lineage)`. The literal order below is the order
 * the design canon prescribes.
 */
export interface Lineage {
  state: TrustState;
  object: string;
  objectSub?: string;
  ownership: OwnershipState;
  /** ISO timestamp. Renderers must use lineageWhen() to humanise. */
  checkedAtIso: string;
  /** Pre-humanised "X seconds ago" / "5 minutes ago" string. */
  checkedAgo: string;
  channel: string;
  replay: ReplayState;
  /** Short identifier (mono / tabular numerals). */
  runId: string;
}

/**
 * Canonical reading order. **Do not reorder.** The order is asserted
 * by trust-lineage-order.test.tsx.
 */
export const LINEAGE_READING_ORDER = [
  'object',
  'ownership',
  'checkedAt',
  'channel',
  'replay',
  'runId',
] as const;

export type LineageCellId = (typeof LINEAGE_READING_ORDER)[number];

/** Demo / fixture provenance — every fixture carries this. */
export interface DemoFixtureMeta {
  /** Single-sentence demo banner shown above the surface. */
  banner: string;
  /** Source attribution shown in the controlled footer. */
  source: 'demo-fixture' | 'design-fixture';
}

/** A signer fixture for the SignaturePanel. Never a real key. */
export interface SignerFixture {
  /** Always "design fixture" or "demo signer fixture" — see brief. */
  label: 'design fixture' | 'demo signer fixture';
  /** Display name (no live credential mapping). */
  displayName: string;
  /** Fixture-only fingerprint, prefixed `fixture:` so it cannot be
   *  mistaken for a real ed25519 / RSA fingerprint. */
  fingerprintFixture: string;
}

/** Receipt artifact — the input to /receipt/[id]. */
export interface ReceiptArtifact {
  id: string;
  lineage: Lineage;
  signer: SignerFixture;
  /** Each chain node is a previous receipt id, oldest first. */
  chain: string[];
  /** Always present — see brief. */
  demoMeta: DemoFixtureMeta;
}

/** Failure-mode descriptor for the Trust State Register page. */
export interface FailureModeDescriptor {
  mode: FailureMode;
  title: string;
  /** Operator-action copy describing the failure and the next step. */
  copy: string;
  /** What MUST NOT happen — operator-action negation. */
  refusalCopy: string;
}

/** Degraded row entry — rendered with dashed border, never opacity. */
export interface DegradedRowEntry {
  reason: DegradedReason;
  /** What lane is degraded (e.g. "OIG LEIE", "State Board CA"). */
  laneLabel: string;
  /** Single-sentence operator-action hint. */
  hint: string;
}
