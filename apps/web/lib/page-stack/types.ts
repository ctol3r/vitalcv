/**
 * PageStack — the spatial pane-stack navigation shell (G2).
 *
 * The open stack of panes lives in the URL, not in React state. This module
 * defines the vocabulary; `pane-key.ts` serializes it; `usePaneStack` derives
 * React state from `useSearchParams`.
 *
 * Each PaneType is a URL token AND maps to a node in the Provider Career Graph
 * contract (@vitalcv/career-graph) — so a pane is always a projection of a real
 * entity, never an ad-hoc screen. Note `employer` → the graph's `organization`.
 */

import type { ComponentType } from 'react';

import type { CareerGraphNodeType } from '@vitalcv/career-graph';

/** The URL vocabulary. A token that isn't one of these is dropped, not rendered. */
export const PANE_TYPES = ['opportunity', 'employer', 'evidence_claim'] as const;

export type PaneType = (typeof PANE_TYPES)[number];

/** Which career-graph node each pane type projects. */
export const PANE_GRAPH_NODE: Record<PaneType, CareerGraphNodeType> = {
  opportunity: 'opportunity',
  employer: 'organization',
  evidence_claim: 'evidence_claim',
};

/** A pane's identity: what entity, which row. This is what the URL encodes. */
export interface PaneKey {
  readonly type: PaneType;
  readonly id: string;
}

/** How a pane type renders and titles itself. Registry-supplied. */
export interface PaneDescriptor {
  readonly type: PaneType;
  readonly graphNodeType: CareerGraphNodeType;
  /** The pane body. Receives only the entity id — it self-loads via an authed API. */
  readonly Component: ComponentType<{ id: string }>;
  /** Shown before the entity loads, and as the accessible pane title fallback. */
  readonly fallbackLabel: string;
}

export type PaneRegistry = Record<PaneType, PaneDescriptor>;

/** A pane resolved against the registry, positioned in the stack. */
export interface PaneInstance extends PaneKey {
  readonly descriptor: PaneDescriptor;
  /** 0-based depth, left to right. */
  readonly index: number;
}

export interface PaneStackState {
  readonly panes: readonly PaneInstance[];
  /** Index of the focused pane. The rightmost pane is the focus. -1 when empty. */
  readonly focusIndex: number;
}
