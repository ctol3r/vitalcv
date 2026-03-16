/**
 * investigationStore.ts — Investigation Context Store
 *
 * React context + useReducer with caching. Panels read from cache
 * and only fetch missing pieces, eliminating full-workbench refetch jitter.
 */

'use client';

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import React from 'react';

// ── Cached data types ──────────────────────────────────────────────────────────

export interface CachedProvider {
  npi: string;
  label: string | null;
  specialty: string | null;
  state: string | null;
  trustScore: number;
  trustBand: string;
  trustConfidence: number;
  activeFindings: number;
  fetchedAt: number;
}

export interface CachedFinding {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  explanation: string;
  confidence: number;
  evidence: Array<{ source: string; claim: string; confidence: number; observedAt?: string | null }>;
  storylineId: string | null;
  storylineTitle: string | null;
  npis: string[];
  fetchedAt: number;
}

export interface CachedStoryline {
  id: string;
  title: string;
  storylineType: string;
  severity: string;
  status: string;
  whyItMatters: string;
  findingCount: number;
  confidence: number;
  recommendedActions: string[];
  fetchedAt: number;
}

export interface CachedGraph {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ source: string; target: string; type: string }>;
  focusNodeId: string | null;
  fetchedAt: number;
}

// ── State ──────────────────────────────────────────────────────────────────────

export interface InvestigationState {
  selectedProvider: string | null;
  selectedFinding: string | null;
  selectedStoryline: string | null;
  selectedEvidence: number;
  copilotCollapsed: boolean;
  evidenceCollapsed: boolean;

  // Caches
  providerCache: Record<string, CachedProvider>;
  findingCache: Record<string, CachedFinding>;
  storylineCache: Record<string, CachedStoryline>;
  graphCache: Record<string, CachedGraph>;

  // Staleness tracking
  lastActivity: number;
}

const INITIAL_STATE: InvestigationState = {
  selectedProvider: null,
  selectedFinding: null,
  selectedStoryline: null,
  selectedEvidence: -1,
  copilotCollapsed: false,
  evidenceCollapsed: false,
  providerCache: {},
  findingCache: {},
  storylineCache: {},
  graphCache: {},
  lastActivity: Date.now(),
};

// ── Actions ────────────────────────────────────────────────────────────────────

export type InvestigationAction =
  | { type: 'SELECT_PROVIDER'; npi: string }
  | { type: 'SELECT_FINDING'; findingId: string | null }
  | { type: 'SELECT_STORYLINE'; storylineId: string | null }
  | { type: 'SELECT_EVIDENCE'; index: number }
  | { type: 'TOGGLE_COPILOT' }
  | { type: 'TOGGLE_EVIDENCE' }
  | { type: 'CACHE_PROVIDER'; provider: CachedProvider }
  | { type: 'CACHE_FINDING'; finding: CachedFinding }
  | { type: 'CACHE_STORYLINE'; storyline: CachedStoryline }
  | { type: 'CACHE_GRAPH'; npi: string; graph: CachedGraph }
  | { type: 'RESET' };

function investigationReducer(
  state: InvestigationState,
  action: InvestigationAction,
): InvestigationState {
  const now = Date.now();
  switch (action.type) {
    case 'SELECT_PROVIDER':
      return { ...state, selectedProvider: action.npi, selectedFinding: null, selectedStoryline: null, selectedEvidence: -1, lastActivity: now };
    case 'SELECT_FINDING':
      return { ...state, selectedFinding: action.findingId, selectedEvidence: -1, lastActivity: now };
    case 'SELECT_STORYLINE':
      return { ...state, selectedStoryline: action.storylineId, lastActivity: now };
    case 'SELECT_EVIDENCE':
      return { ...state, selectedEvidence: action.index, lastActivity: now };
    case 'TOGGLE_COPILOT':
      return { ...state, copilotCollapsed: !state.copilotCollapsed };
    case 'TOGGLE_EVIDENCE':
      return { ...state, evidenceCollapsed: !state.evidenceCollapsed };
    case 'CACHE_PROVIDER':
      return { ...state, providerCache: { ...state.providerCache, [action.provider.npi]: action.provider } };
    case 'CACHE_FINDING':
      return { ...state, findingCache: { ...state.findingCache, [action.finding.id]: action.finding } };
    case 'CACHE_STORYLINE':
      return { ...state, storylineCache: { ...state.storylineCache, [action.storyline.id]: action.storyline } };
    case 'CACHE_GRAPH':
      return { ...state, graphCache: { ...state.graphCache, [action.npi]: action.graph } };
    case 'RESET':
      return { ...INITIAL_STATE, lastActivity: now };
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

const InvestigationStateCtx = createContext<InvestigationState>(INITIAL_STATE);
const InvestigationDispatchCtx = createContext<Dispatch<InvestigationAction>>(() => {});

export function InvestigationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(investigationReducer, INITIAL_STATE);
  return React.createElement(
    InvestigationStateCtx.Provider,
    { value: state },
    React.createElement(InvestigationDispatchCtx.Provider, { value: dispatch }, children),
  );
}

export function useInvestigationState(): InvestigationState {
  return useContext(InvestigationStateCtx);
}

export function useInvestigationDispatch(): Dispatch<InvestigationAction> {
  return useContext(InvestigationDispatchCtx);
}

// ── Cache helpers ──────────────────────────────────────────────────────────────

const STALE_MS = 60_000; // 60s

export function isCacheStale(fetchedAt: number): boolean {
  return Date.now() - fetchedAt > STALE_MS;
}

export function getCachedProvider(state: InvestigationState, npi: string): CachedProvider | null {
  const cached = state.providerCache[npi];
  return cached && !isCacheStale(cached.fetchedAt) ? cached : null;
}

export function getCachedGraph(state: InvestigationState, npi: string): CachedGraph | null {
  const cached = state.graphCache[npi];
  return cached && !isCacheStale(cached.fetchedAt) ? cached : null;
}

export function getTimeSinceActivity(state: InvestigationState): number {
  return Math.round((Date.now() - state.lastActivity) / 1000);
}
