/**
 * Canonical provenance-navigation contract.
 *
 * Establishes the **only** legal rules for trust-pane exploration in
 * VitalCV. Builds on `apps/web/lib/trust/panes.ts` (URL contract for
 * the Stacked Provenance Ledger). This module owns the **semantics**:
 * what qualifies as a provenance pane, how panes are traversed, when
 * a stack must truncate, and how backlinks behave.
 *
 * The contract is closed and binding. Anything that isn't named here
 * is not permitted in pane navigation — settings dialogs, marketing
 * cards, dashboard tiles, onboarding overlays, and ad-hoc modals do
 * not belong in the pane stack and must use route-level navigation
 * instead.
 */

import {
  PANE_KINDS,
  closePaneAt,
  pushPane,
  type PaneRef,
} from './panes';

// ── Canonical categories (binding) ─────────────────────────────────────────

/**
 * The five — and only five — pane categories permitted in provenance
 * navigation. Matches `PANE_KINDS` in panes.ts; re-exported here to
 * keep the navigation-semantics surface self-contained.
 */
export const PROVENANCE_PANE_CATEGORIES = PANE_KINDS;

export type ProvenancePaneCategory = (typeof PROVENANCE_PANE_CATEGORIES)[number];

/**
 * Plain-language description for each category — used in the
 * documentation and in `ProvenancePaneHeader` captions so the same
 * vocabulary is rendered everywhere a pane is shown.
 */
export const PROVENANCE_PANE_DESCRIPTIONS: Record<
  ProvenancePaneCategory,
  string
> = {
  receipt: 'signed evidentiary artifact · σ-anchored',
  audit: 'audit row · σ verdict against a receipt',
  claim: 'single source-of-record check',
  lineage: 'lineage key · subject + lane binding',
  entity: 'passport / NPI · subject of record',
};

// ── Canonical ordering (binding) ────────────────────────────────────────────

/**
 * Canonical sort weight per category. When a list of panes is rendered
 * in a non-temporal context (e.g. a breadcrumb, a trail summary, an
 * audit doc), this is the binding ordering: deepest semantic provenance
 * first (receipts), broadest binding last (entity).
 *
 * Inside a single user-driven stack, ordering is **temporal** — the
 * order the user pushed the panes — and this constant is ignored.
 */
export const PROVENANCE_CATEGORY_ORDER: Record<ProvenancePaneCategory, number> = {
  receipt: 0,
  audit: 1,
  claim: 2,
  lineage: 3,
  entity: 4,
};

/**
 * Returns a deterministic ordering of an arbitrary pane list. Stable
 * sort: ties on category fall back to lexicographic id. Used by
 * `ProvenanceTrail` and audit-doc renderers to render consistently.
 */
export function deterministicallyOrderPanes(
  panes: readonly PaneRef[],
): readonly PaneRef[] {
  return [...panes].sort((a, b) => {
    const da = PROVENANCE_CATEGORY_ORDER[a.kind] ?? 99;
    const db = PROVENANCE_CATEGORY_ORDER[b.kind] ?? 99;
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
}

// ── Pane-depth governance (binding) ─────────────────────────────────────────

/**
 * Maximum number of panes in a single user-driven stack.
 *
 * Rationale:
 * - Mobile-friendly truncation: at 32rem pane width + 40px stack
 *   offset, 7 panes still leave ~3.5 panes visible on a 13" laptop.
 * - Comprehensibility: exploration paths beyond 7 hops nearly always
 *   indicate a navigation mistake; truncation prevents accidental
 *   recursion bombs from runaway backlink loops.
 * - Browser back: 7 router.push() calls remain navigable without
 *   exhausting the user's mental model of the back button.
 *
 * Stacks longer than this are truncated by `enforcePaneDepth` at the
 * tail (drop oldest panes), preserving the active rightmost pane.
 */
export const MAX_PANE_DEPTH = 7;

export function enforcePaneDepth(
  panes: readonly PaneRef[],
  max: number = MAX_PANE_DEPTH,
): { panes: readonly PaneRef[]; truncated: number } {
  if (panes.length <= max) return { panes, truncated: 0 };
  const truncated = panes.length - max;
  return { panes: panes.slice(-max), truncated };
}

// ── Cycle protection (binding) ──────────────────────────────────────────────

export function paneKey(ref: PaneRef): string {
  return `${ref.kind}:${ref.id}`;
}

/**
 * Returns true if `next` would create a cycle relative to `current`.
 * A cycle is any push that lands on a pane already present in the
 * stack — backlinks must never produce recursive pane explosions.
 *
 * Caller policy: when this returns true, do not push. The recommended
 * affordance is to surface the existing pane (scroll it into view)
 * rather than open a duplicate.
 */
export function wouldCycle(
  current: readonly PaneRef[],
  next: PaneRef,
): boolean {
  const target = paneKey(next);
  return current.some((p) => paneKey(p) === target);
}

/**
 * Safe push: combines `pushPane` from panes.ts with cycle detection
 * AND `enforcePaneDepth`. The single entry point callers should use
 * for any user-driven navigation.
 *
 * Returns the next stack; on cycle, returns the current stack
 * unchanged with `cycled: true` so callers can render a
 * "pane already open" affordance.
 */
export interface SafePushResult {
  panes: readonly PaneRef[];
  cycled: boolean;
  truncated: number;
}

export function safePush(
  current: readonly PaneRef[],
  fromIndex: number,
  next: PaneRef,
): SafePushResult {
  if (wouldCycle(current, next)) {
    return { panes: current, cycled: true, truncated: 0 };
  }
  const pushed = pushPane(current, fromIndex, next);
  const { panes, truncated } = enforcePaneDepth(pushed);
  return { panes, cycled: false, truncated };
}

// ── Backlink semantics (binding) ────────────────────────────────────────────

/**
 * Direction tag on a `ProvenanceBinding`.
 *
 * - `inbound`  — "what binds TO this pane". Lineage backlinks must
 *               always be inbound; this is the cryptographic-visibility
 *               direction.
 * - `forward`  — "what this pane references". Forward bindings are
 *               navigational shortcuts (e.g. "open bound receipt");
 *               they may NOT be rendered as a `LineageBacklinks` row.
 *
 * The two directions must be visually distinct so a reader cannot
 * confuse "X signed this" (inbound) with "this points to X" (forward).
 */
export type BindingDirection = 'inbound' | 'forward';

/**
 * Closed taxonomy of binding rationales. Free-form strings are still
 * accepted on the rendering primitive for caller flexibility, but
 * canonical rationales should use these tokens when available so the
 * audit doc and tests can assert on them.
 */
export const BINDING_RATIONALES = [
  'signed_this_claim',
  'audit_row_consumed',
  'lineage_key_feed',
  'bound_subject',
  'continuity_witness',
  'rotation_co_sign',
] as const;

export type BindingRationale = (typeof BINDING_RATIONALES)[number];

export const BINDING_RATIONALE_COPY: Record<BindingRationale, string> = {
  signed_this_claim: 'signed this claim',
  audit_row_consumed: 'audit row consumed this receipt',
  lineage_key_feed: 'lineage key that this claim feeds',
  bound_subject: 'passport / NPI the audit binds to',
  continuity_witness: 'continuity witness for this run',
  rotation_co_sign: 'co-signed across key rotation',
};

// ── Navigation ownership (documentation) ────────────────────────────────────

/**
 * Which surfaces own pane navigation.
 *
 * - The Stacked Provenance Ledger (`/trust/panes/[receiptId]`) is the
 *   canonical home and owns the navigation contract end-to-end.
 * - Receipt-style routes (`/verify/receipt/[receiptId]`,
 *   `/receipt/[receiptId]`, `/dossier/[receiptId]`) MAY embed the
 *   pane layout but MUST NOT introduce new pane categories.
 * - Settings, onboarding, marketing, dashboard, app-shell surfaces
 *   do NOT own pane navigation and MUST use route-level navigation
 *   for transitions.
 *
 * Anything not in `PROVENANCE_PANE_CATEGORIES` is by definition
 * outside the contract and is rejected by the type system.
 */
export const NAVIGATION_OWNERSHIP = {
  canonical: '/trust/panes/[receiptId]',
  mayEmbed: [
    '/verify/receipt/[receiptId]',
    '/receipt/[receiptId]',
    '/dossier/[receiptId]',
    '/passport/[id]',
  ] as const,
  mustNotEmbed: [
    '/signup',
    '/onboarding',
    '/for/*',
    '/get-ready',
    '/pilot',
    '/settings/*',
    'app shell / navigation chrome',
  ] as const,
} as const;

// ── Re-export the safe close helper for symmetry ───────────────────────────

export const safeClose = closePaneAt;
