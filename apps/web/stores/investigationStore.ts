/**
 * investigationStore.ts — Investigation Context Store
 *
 * React context + useReducer store for the Investigation Workbench.
 * All panels subscribe to shared state: selectedFinding, selectedProvider,
 * selectedStoryline, selectedEvidence.
 *
 * No external deps (no Zustand) — pure React.
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

// ── State ──────────────────────────────────────────────────────────────────────

export interface InvestigationState {
  /** Provider NPI currently under investigation */
  selectedProvider: string | null;
  /** Active finding ID */
  selectedFinding: string | null;
  /** Active storyline ID */
  selectedStoryline: string | null;
  /** Index of expanded evidence item (-1 = none) */
  selectedEvidence: number;
  /** Copilot panel collapsed */
  copilotCollapsed: boolean;
  /** Evidence panel collapsed */
  evidenceCollapsed: boolean;
}

const INITIAL_STATE: InvestigationState = {
  selectedProvider: null,
  selectedFinding: null,
  selectedStoryline: null,
  selectedEvidence: -1,
  copilotCollapsed: false,
  evidenceCollapsed: false,
};

// ── Actions ────────────────────────────────────────────────────────────────────

export type InvestigationAction =
  | { type: 'SELECT_PROVIDER'; npi: string }
  | { type: 'SELECT_FINDING'; findingId: string | null }
  | { type: 'SELECT_STORYLINE'; storylineId: string | null }
  | { type: 'SELECT_EVIDENCE'; index: number }
  | { type: 'TOGGLE_COPILOT' }
  | { type: 'TOGGLE_EVIDENCE' }
  | { type: 'RESET' };

function investigationReducer(
  state: InvestigationState,
  action: InvestigationAction,
): InvestigationState {
  switch (action.type) {
    case 'SELECT_PROVIDER':
      return {
        ...state,
        selectedProvider: action.npi,
        selectedFinding: null,
        selectedStoryline: null,
        selectedEvidence: -1,
      };
    case 'SELECT_FINDING':
      return { ...state, selectedFinding: action.findingId, selectedEvidence: -1 };
    case 'SELECT_STORYLINE':
      return { ...state, selectedStoryline: action.storylineId };
    case 'SELECT_EVIDENCE':
      return { ...state, selectedEvidence: action.index };
    case 'TOGGLE_COPILOT':
      return { ...state, copilotCollapsed: !state.copilotCollapsed };
    case 'TOGGLE_EVIDENCE':
      return { ...state, evidenceCollapsed: !state.evidenceCollapsed };
    case 'RESET':
      return INITIAL_STATE;
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
    React.createElement(
      InvestigationDispatchCtx.Provider,
      { value: dispatch },
      children,
    ),
  );
}

export function useInvestigationState(): InvestigationState {
  return useContext(InvestigationStateCtx);
}

export function useInvestigationDispatch(): Dispatch<InvestigationAction> {
  return useContext(InvestigationDispatchCtx);
}

export function initStateFromParams(params: {
  npi?: string;
  findingId?: string;
  storylineId?: string;
}): InvestigationState {
  return {
    ...INITIAL_STATE,
    selectedProvider: params.npi ?? null,
    selectedFinding: params.findingId ?? null,
    selectedStoryline: params.storylineId ?? null,
  };
}
