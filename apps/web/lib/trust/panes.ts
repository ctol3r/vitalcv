/**
 * URL-driven pane state for the Stacked Provenance Ledger.
 *
 * Inspired by Andy Matuschak's working notes — every navigation step
 * pushes a new pane to the right of the stack and the URL becomes the
 * canonical, shareable, reload-survivable representation of the user's
 * exploration path.
 *
 * URL contract:
 *
 *     ?panes=receipt-7a2cb8d3,audit-evt_8821,lineage-nppes_identity
 *
 * Each pane token is `<kind>-<id>`. Pane kinds are closed; the type
 * system rejects unknown kinds at compile time. IDs are restricted to
 * `[A-Za-z0-9_-]+` so the URL is never ambiguous and never needs
 * percent-encoding.
 */

export const PANE_KINDS = [
  'receipt',
  'audit',
  'claim',
  'lineage',
  'entity',
] as const;

export type PaneKind = (typeof PANE_KINDS)[number];

export interface PaneRef {
  readonly kind: PaneKind;
  readonly id: string;
}

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const SEPARATOR = ',';
const KIND_SEPARATOR = '-';

function isPaneKind(value: string): value is PaneKind {
  return (PANE_KINDS as readonly string[]).includes(value);
}

function isValidId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && ID_PATTERN.test(id);
}

/**
 * Parses the `panes` search-param value into an ordered list of
 * `PaneRef`. Malformed tokens are silently dropped — the URL is
 * user-editable and a bad pane should not crash the layout. Duplicates
 * are preserved in order; deduping is a caller policy decision.
 */
export function parsePanes(raw: string | null | undefined): readonly PaneRef[] {
  if (!raw) return [];
  return raw
    .split(SEPARATOR)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token): PaneRef | null => {
      const dashIndex = token.indexOf(KIND_SEPARATOR);
      if (dashIndex <= 0) return null;
      const kind = token.slice(0, dashIndex);
      const id = token.slice(dashIndex + 1);
      if (!isPaneKind(kind)) return null;
      if (!isValidId(id)) return null;
      return { kind, id };
    })
    .filter((ref): ref is PaneRef => ref !== null);
}

export function serializePanes(panes: readonly PaneRef[]): string {
  return panes
    .filter((p) => isPaneKind(p.kind) && isValidId(p.id))
    .map((p) => `${p.kind}${KIND_SEPARATOR}${p.id}`)
    .join(SEPARATOR);
}

/**
 * Returns the next stack when a new pane is opened from a pane at
 * `fromIndex`. Mirrors Matuschak's behavior: opening a child from
 * pane N replaces panes (N+1..end) and appends the new child. This
 * keeps the stack a single tree-path rather than a fork.
 */
export function pushPane(
  current: readonly PaneRef[],
  fromIndex: number,
  next: PaneRef,
): readonly PaneRef[] {
  const cut = current.slice(0, fromIndex + 1);
  // Avoid no-op pushes when the user re-clicks the same destination
  const last = cut[cut.length - 1];
  if (last && last.kind === next.kind && last.id === next.id) {
    return cut;
  }
  return [...cut, next];
}

/**
 * Removes the pane at `index` and every pane to its right.
 */
export function closePaneAt(
  current: readonly PaneRef[],
  index: number,
): readonly PaneRef[] {
  if (index < 0 || index >= current.length) return current;
  return current.slice(0, index);
}

export function paneToken(ref: PaneRef): string {
  return `${ref.kind}${KIND_SEPARATOR}${ref.id}`;
}

/**
 * Pane stacking offset in pixels. Stacked left-edge of each pane
 * advances by this much; the active rightmost pane scrolls into view
 * fully. Hard-coded here so layout math is shared between
 * StackedPaneLayout and tests.
 */
export const PANE_STACK_OFFSET_PX = 40;

/**
 * Default width of a single pane (rem). Pane widths are intentionally
 * fixed so the stacked-card metaphor holds at any viewport width and
 * panes feel like physical index cards rather than fluid grid cells.
 */
export const PANE_WIDTH_REM = 32;
