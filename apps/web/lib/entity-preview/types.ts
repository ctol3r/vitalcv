/**
 * Entity preview contract (G3).
 *
 * A preview is the lightweight answer to "what is this, why is it linked here,
 * what state is it in, is anything stale/gated/unknown" — shown before a hover
 * or focus commits to opening the full entity in a pane. It is deliberately
 * small and authorization-safe: a preview must never expose a value the viewer
 * could not obtain by opening the entity itself, and must never confirm the
 * existence of an entity the viewer is not allowed to see (the resolver returns
 * a uniform not-found, never a 403, so a preview cannot be used to enumerate).
 */

import { PANE_TYPES, type PaneType } from '@/lib/page-stack/types';

/** Preview-able entity types == the pane vocabulary. */
export const PREVIEWABLE_TYPES = PANE_TYPES;
export type PreviewableType = PaneType;

/** One labelled fact in a preview — kept to plain strings, no nested payloads. */
export interface PreviewField {
  readonly label: string;
  readonly value: string;
  /** Source-coverage honesty: checked | gated | stale | unknown | self-attested. */
  readonly state?: 'checked' | 'gated' | 'stale' | 'unknown' | 'self_attested';
}

export interface EntityPreview {
  readonly type: PreviewableType;
  readonly id: string;
  /** Primary label — what this is. */
  readonly title: string;
  /** One line of context — usually "why it's linked here" or its kind. */
  readonly subtitle?: string;
  /** A short current-state word (e.g. "Access required", "Open", "Superseded"). */
  readonly state?: string;
  /** Up to a handful of authorization-safe fields. */
  readonly fields?: readonly PreviewField[];
}

export function isPreviewableType(value: string): value is PreviewableType {
  return (PREVIEWABLE_TYPES as readonly string[]).includes(value);
}
