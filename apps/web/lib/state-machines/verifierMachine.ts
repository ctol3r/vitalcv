'use client';

/**
 * verifierMachine.ts — Wave 130
 *
 * Manages the verifier review flow:
 * IDLE → REVIEWING → ACCEPTING → ACCEPTED
 *                  ↘ REJECTED
 *                  ↘ ERROR
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

export type VerifierState =
  | 'IDLE'
  | 'REVIEWING'
  | 'ACCEPTING'
  | 'REJECTED'
  | 'ACCEPTED'
  | 'ERROR';

// ── Events ────────────────────────────────────────────────────────────

export type VerifierEvent =
  | 'START_REVIEW'
  | 'ACCEPT'
  | 'REJECT'
  | 'CONFIRM'
  | 'ERROR_OCCURRED'
  | 'RESET';

// ── Context ───────────────────────────────────────────────────────────

export interface VerifierContext {
  presentationId: string | null;
  decision: 'accepted' | 'rejected' | null;
  error: string | null;
}

const DEFAULT_CONTEXT: VerifierContext = {
  presentationId: null,
  decision: null,
  error: null,
};

// ── Config ────────────────────────────────────────────────────────────

const verifierConfig: StateMachineConfig<VerifierState, VerifierEvent, VerifierContext> = {
  states: ['IDLE', 'REVIEWING', 'ACCEPTING', 'REJECTED', 'ACCEPTED', 'ERROR'],
  initial: 'IDLE',
  transitions: {
    IDLE:      { START_REVIEW: 'REVIEWING' },
    REVIEWING: { ACCEPT: 'ACCEPTING', REJECT: 'REJECTED', ERROR_OCCURRED: 'ERROR' },
    ACCEPTING: { CONFIRM: 'ACCEPTED', ERROR_OCCURRED: 'ERROR', RESET: 'REVIEWING' },
    REJECTED:  { RESET: 'IDLE' },
    ACCEPTED:  { RESET: 'IDLE' },
    ERROR:     { RESET: 'IDLE', START_REVIEW: 'REVIEWING' },
  },
};

const verifierReducer = createMachineReducer(verifierConfig);

// ── Hook ──────────────────────────────────────────────────────────────

export interface VerifierMachineAPI {
  state: MachineState<VerifierState, VerifierContext>;
  send: (event: MachineAction<VerifierEvent>) => void;
  is: (s: VerifierState) => boolean;
  isReviewing: boolean;
  isAccepting: boolean;
  isSettled: boolean;
  hasError: boolean;
}

export function useVerifierMachine(): VerifierMachineAPI {
  const [state, dispatch] = useReducer(
    verifierReducer,
    initialMachineState<VerifierState, VerifierContext>('IDLE', DEFAULT_CONTEXT),
  );

  return {
    state,
    send: dispatch,
    is: (s) => state.current === s,
    isReviewing: state.current === 'REVIEWING',
    isAccepting: state.current === 'ACCEPTING',
    isSettled: state.current === 'ACCEPTED' || state.current === 'REJECTED',
    hasError: state.current === 'ERROR',
  };
}
