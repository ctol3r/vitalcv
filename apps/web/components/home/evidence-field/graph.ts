/**
 * evidence-field/graph.ts — the homepage evidence graph's LAYOUT + STATE model.
 *
 * The previous hero field was a seeded particle scatter: atoms sprayed around a
 * capsule at pseudo-random offsets, which read as noise rather than as a system
 * with parts. This module replaces that with an explicit, deterministic
 * composition that a person can actually parse in one look:
 *
 *     four named public sources  →  one clinician-owned record  →  what it unlocks
 *      (left column)                    (centre hub)                (right)
 *
 * Coordinates are NORMALIZED (0–1) and rendered as CSS percentages, never a
 * viewBox. A `viewBox` + `preserveAspectRatio: slice` is what cropped ~40% of
 * the old composition out of the tall desktop panel — "present but invisible".
 * Percentages keep every node in-pane at any panel aspect.
 *
 * Every label here is a real, named public lane or an abstract role. Nothing in
 * this file names a person, an employer, or an outcome.
 */

/** The evidence states the homepage distinguishes. One legend, one grammar. */
export type EvidenceState =
  | 'source-backed'
  | 'checked'
  | 'access-required'
  | 'employer-decision'
  /** A lane whose live result has not come back yet (live mode only). */
  | 'resolving';

/**
 * The closed set of node ids. Declared as a union rather than `string` so that
 * adding a node forces every consumer that switches on an id to be updated —
 * including `FieldAnchor` in ./model.ts, which derives from this.
 */
export type GraphNodeId =
  | 'nppes'
  | 'oig-leie'
  | 'pecos'
  | 'licensure'
  | 'record'
  | 'opportunity'
  | 'decision';

export interface GraphNode {
  id: GraphNodeId;
  label: string;
  /** Normalized 0–1 position. */
  x: number;
  y: number;
  /** What this node is, in one line — surfaced on hover/focus. */
  detail: string;
  state: EvidenceState;
}

/**
 * The four public lanes, in the order a clinician meets them. Their DEFAULT
 * states describe the lane itself (what VitalCV can read at all), not any
 * individual's result — live mode overwrites these per lookup.
 *
 * State licensure is deliberately present and deliberately `access-required`:
 * a legend that lists "Access required" while no node ever carries it is the
 * kind of incoherence that makes a diagram read as decoration.
 */
export const SOURCE_NODES: readonly GraphNode[] = [
  {
    id: 'nppes',
    label: 'NPPES',
    x: 0.1,
    y: 0.16,
    detail: 'The federal NPI registry. Read live, per request.',
    state: 'source-backed',
  },
  {
    id: 'oig-leie',
    label: 'OIG / LEIE',
    x: 0.1,
    y: 0.39,
    detail: 'Federal exclusion list. A monthly snapshot, shown with its age.',
    state: 'checked',
  },
  {
    id: 'pecos',
    label: 'PECOS',
    x: 0.1,
    y: 0.62,
    detail: 'Medicare enrollment. A quarterly snapshot, shown with its age.',
    state: 'checked',
  },
  {
    id: 'licensure',
    label: 'State licensure',
    x: 0.1,
    y: 0.85,
    detail: 'State boards are access-gated. VitalCV does not read them without agreements.',
    state: 'access-required',
  },
] as const;

/** The clinician-owned hub every source converges into. */
export const RECORD_NODE: GraphNode = {
  id: 'record',
  label: 'Your career record',
  x: 0.5,
  y: 0.5,
  detail: 'One record you own, carried between jobs.',
  state: 'source-backed',
};

/** What the record unlocks. `decision` is the ONE bounded employer ring. */
export const OUTCOME_NODES: readonly GraphNode[] = [
  {
    id: 'opportunity',
    label: 'Opportunity',
    x: 0.88,
    y: 0.28,
    detail: 'Roles you can apply to without starting your paperwork over.',
    state: 'employer-decision',
  },
  {
    id: 'decision',
    label: 'Employer decision',
    x: 0.88,
    y: 0.72,
    detail: 'Institution review stays the final step. VitalCV never makes this call.',
    state: 'employer-decision',
  },
] as const;

export const ALL_NODES: readonly GraphNode[] = [
  ...SOURCE_NODES,
  RECORD_NODE,
  ...OUTCOME_NODES,
];

/** Directed edges: sources feed the record, the record feeds the outcomes. */
export const EDGES: readonly { from: string; to: string }[] = [
  ...SOURCE_NODES.map((n) => ({ from: n.id, to: RECORD_NODE.id })),
  ...OUTCOME_NODES.map((n) => ({ from: RECORD_NODE.id, to: n.id })),
];

/**
 * The legend, and the single source of truth for state → colour. These bind to
 * the Calm Wave tokens so the graph inherits Cloud Dancer's palette rather than
 * carrying its own.
 */
export const STATE_LEGEND: readonly { state: EvidenceState; label: string; color: string }[] = [
  { state: 'source-backed', label: 'Source-backed', color: 'var(--vt-accent-emerald)' },
  { state: 'checked', label: 'Checked', color: 'var(--accent, #4f46e5)' },
  { state: 'access-required', label: 'Access required', color: 'var(--vt-state-stale, #a2670b)' },
  { state: 'employer-decision', label: 'Employer decision', color: 'var(--vt-text-muted)' },
] as const;

export function stateColor(state: EvidenceState): string {
  if (state === 'resolving') return 'var(--vt-text-muted)';
  return STATE_LEGEND.find((s) => s.state === state)?.color ?? 'var(--vt-text-muted)';
}

export function nodeById(id: string): GraphNode | undefined {
  return ALL_NODES.find((n) => n.id === id);
}

/**
 * Percentage string for SVG SHAPE geometry (cx/cy/r). Shape attributes accept
 * percentages; this is what keeps the node circles in-pane at any aspect
 * without a cropping viewBox.
 */
export const pct = (n: number): string => `${(n * 100).toFixed(2)}%`;

/**
 * EDGE_VIEWBOX — the coordinate space the edge layer draws in.
 *
 * Path data (`d`) does NOT accept percentages: `d="M 10% 16% …"` is invalid and
 * the browser drops the whole path. (It renders nothing and logs
 * `<path> attribute d: Expected number` — which is exactly how a graph ends up
 * as disconnected dots.) So edges live in their own SVG layer with a
 * `0 0 100 100` viewBox and `preserveAspectRatio="none"`, which maps user units
 * onto the box in both axes — numerically identical to what percentages do for
 * the node layer, with no cropping. Strokes carry `vector-effect:
 * non-scaling-stroke` so the non-uniform stretch cannot fatten them.
 */
export const EDGE_VIEWBOX = '0 0 100 100';

/**
 * A quadratic bezier from `a` to `b` that bows toward the horizontal axis, so
 * converging edges fan instead of overlapping into a starburst. Pure geometry —
 * deterministic, SSR-safe, no randomness. Emits plain numbers in EDGE_VIEWBOX
 * units (0–100), never percentages.
 */
export function edgePath(a: GraphNode, b: GraphNode): string {
  const u = (n: number) => (n * 100).toFixed(2);
  const midX = (a.x + b.x) / 2;
  // Bow AWAY from the hub's vertical centre so the four in-edges stay separable.
  const bow = (a.y - b.y) * 0.28;
  const cy = (a.y + b.y) / 2 - bow;
  return `M ${u(a.x)} ${u(a.y)} Q ${u(midX)} ${u(cy)} ${u(b.x)} ${u(b.y)}`;
}

/* ── Live mode ─────────────────────────────────────────────────────────────
 * Mapping a REAL /api/trust-state result onto the lanes above. This is the only
 * place a live lookup becomes graph state, and it is deliberately conservative:
 * a lane only reaches `source-backed` when the API affirmatively says so.
 */

export interface LiveTrust {
  identityVerified?: boolean;
  exclusionStatus?: string;
  pecosStatus?: string;
  licensureStatus?: string;
}

export function liveSourceStates(trust: LiveTrust | null): Record<string, EvidenceState> {
  if (!trust) {
    return Object.fromEntries(SOURCE_NODES.map((n) => [n.id, 'resolving' as EvidenceState]));
  }
  return {
    nppes: trust.identityVerified ? 'source-backed' : 'access-required',
    'oig-leie':
      trust.exclusionStatus === 'CLEAR'
        ? 'checked'
        : trust.exclusionStatus === 'UNCHECKED'
          ? 'access-required'
          : 'checked',
    pecos: trust.pecosStatus === 'NOT_FOUND' ? 'access-required' : 'checked',
    // Licensure never auto-clears: state boards stay access-gated by policy.
    licensure: 'access-required',
  };
}
