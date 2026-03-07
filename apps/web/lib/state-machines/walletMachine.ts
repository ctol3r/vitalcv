'use client';

/**
 * walletMachine.ts — Wave 130
 *
 * Manages the clinician wallet UI flow:
 * IDLE → LOADING → CREDENTIAL_LIST → DISCLOSURE_SELECTING → PRESENTING → PRESENTED
 *                                                                        ↘ ERROR (any step)
 */

import { useReducer } from 'react';
import {
  createMachineReducer,
  initialMachineState,
  type StateMachineConfig,
  type MachineState,
  type MachineAction,
} from './types';

// ── States ────────────────────────────────────────────────────────────

export type WalletState =
  | 'IDLE'
  | 'LOADING'
  | 'CREDENTIAL_LIST'
  | 'DISCLOSURE_SELECTING'
  | 'PRESENTING'
  | 'PRESENTED'
  | 'ERROR';

// ── Events ────────────────────────────────────────────────────────────

export type WalletEvent =
  | 'LOAD'
  | 'LOAD_SUCCESS'
  | 'LOAD_ERROR'
  | 'SELECT_CREDENTIAL'
  | 'TOGGLE_CLAIM'
  | 'SUBMIT'
  | 'SUBMIT_SUCCESS'
  | 'SUBMIT_ERROR'
  | 'RESET';

// ── Context ───────────────────────────────────────────────────────────

export interface WalletContext {
  selectedCredentialId: string | null;
  selectedClaims: string[];
  error: string | null;
}

const DEFAULT_CONTEXT: WalletContext = {
  selectedCredentialId: null,
  selectedClaims: [],
  error: null,
};

// ── Config ────────────────────────────────────────────────────────────

const walletConfig: StateMachineConfig<WalletState, WalletEvent, WalletContext> = {
  states: ['IDLE', 'LOADING', 'CREDENTIAL_LIST', 'DISCLOSURE_SELECTING', 'PRESENTING', 'PRESENTED', 'ERROR'],
  initial: 'IDLE',
  transitions: {
    IDLE:                 { LOAD: 'LOADING' },
    LOADING:              { LOAD_SUCCESS: 'CREDENTIAL_LIST', LOAD_ERROR: 'ERROR' },
    CREDENTIAL_LIST:      { SELECT_CREDENTIAL: 'DISCLOSURE_SELECTING', LOAD: 'LOADING' },
    DISCLOSURE_SELECTING: { TOGGLE_CLAIM: 'DISCLOSURE_SELECTING', SUBMIT: 'PRESENTING', RESET: 'CREDENTIAL_LIST' },
    PRESENTING:           { SUBMIT_SUCCESS: 'PRESENTED', SUBMIT_ERROR: 'ERROR' },
    PRESENTED:            { RESET: 'IDLE' },
    ERROR:                { RESET: 'IDLE', LOAD: 'LOADING' },
  },
};

const walletReducer = createMachineReducer(walletConfig);

// ── Hook ──────────────────────────────────────────────────────────────

export interface WalletMachineAPI {
  state: MachineState<WalletState, WalletContext>;
  send: (event: MachineAction<WalletEvent>) => void;
  /** Convenience predicates */
  is: (s: WalletState) => boolean;
  isLoading: boolean;
  isSelectingClaims: boolean;
  isPresenting: boolean;
  hasError: boolean;
}

export function useWalletMachine(): WalletMachineAPI {
  const [state, dispatch] = useReducer(
    walletReducer,
    initialMachineState<WalletState, WalletContext>('IDLE', DEFAULT_CONTEXT),
  );

  return {
    state,
    send: dispatch,
    is: (s) => state.current === s,
    isLoading: state.current === 'LOADING',
    isSelectingClaims: state.current === 'DISCLOSURE_SELECTING',
    isPresenting: state.current === 'PRESENTING',
    hasError: state.current === 'ERROR',
  };
}
