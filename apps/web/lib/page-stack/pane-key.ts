/**
 * Pane ⇄ URL-token serialization. Pure, dependency-free, exhaustively testable.
 *
 * Token grammar: `<type>:<encodeURIComponent(id)>`
 *   opportunity:opp_123
 *   employer:org_456
 *   evidence_claim:claim%3Aabc   (ids may contain anything; the id is encoded)
 *
 * The whole stack is the ordered list of `pane` query params. Order is stack
 * depth, left→right; the rightmost pane is the focus. Malformed or unknown-type
 * tokens are dropped (never thrown) so a hand-edited or stale URL degrades to
 * the panes it CAN resolve rather than erroring the whole surface.
 */

import { PANE_TYPES, type PaneKey, type PaneType } from './types';

const PANE_TYPE_SET: ReadonlySet<string> = new Set(PANE_TYPES);

function isPaneType(value: string): value is PaneType {
  return PANE_TYPE_SET.has(value);
}

/** `{type,id}` → `type:encoded-id`. */
export function formatPaneToken(key: PaneKey): string {
  return `${key.type}:${encodeURIComponent(key.id)}`;
}

/**
 * `type:encoded-id` → `{type,id}`, or null if the token is malformed or names a
 * type outside the registry vocabulary. Splits on the FIRST colon only, so an
 * encoded id that itself contains `%3A` survives the round trip.
 */
export function parsePaneToken(token: string): PaneKey | null {
  const colon = token.indexOf(':');
  if (colon <= 0 || colon === token.length - 1) return null;

  const type = token.slice(0, colon);
  if (!isPaneType(type)) return null;

  const rawId = token.slice(colon + 1);
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    // Malformed percent-encoding — drop the pane rather than crash the stack.
    return null;
  }
  if (id.length === 0) return null;

  return { type, id };
}

/**
 * The full list of `pane` param values → the resolved, ordered stack.
 * Duplicates (same type+id already earlier in the stack) are dropped so a pane
 * can't appear twice; unresolvable tokens are skipped.
 */
export function parsePaneParams(tokens: readonly string[]): PaneKey[] {
  const keys: PaneKey[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const key = parsePaneToken(token);
    if (!key) continue;
    const dedupeKey = `${key.type}:${key.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    keys.push(key);
  }
  return keys;
}

/** The ordered stack → the `pane` param values to write back to the URL. */
export function formatPaneParams(keys: readonly PaneKey[]): string[] {
  return keys.map(formatPaneToken);
}

/** Structural equality for two pane keys. */
export function paneKeysEqual(a: PaneKey, b: PaneKey): boolean {
  return a.type === b.type && a.id === b.id;
}
