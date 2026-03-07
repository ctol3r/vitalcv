'use client';

/**
 * simulationMachine.ts — Wave 130
 *
 * Manages the blast-radius simulation flow:
 * IDLE → CONFIGURING → SIMULATING → BLAST_RADIUS_COMPUTED
 *                                 ↘ ERROR
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

export type SimulationState =
  | 'IDLE'
  | 'CONFIGURING'
  | 'SIMULATING'
  | 'BLAST_RADIUS_COMPUTED'
  | 'ERROR';

// ── Events ────────────────────────────────────────────────────────────

export type SimulationEvent =
  | 'CONFIGURE'
  | 'RUN'
  | 'COMPLETE'
  | 'FAIL'
  | 'RESET';

// ── Context ───────────────────────────────────────────────────────────

export interface SimulationContext {
  npi: string;
  eventType: string | null;
  error: string | null;
}

const DEFAULT_CONTEXT: SimulationContext = {
  npi: '',
  eventType: null,
  error: null,
};

// ── Config ────────────────────────────────────────────────────────────

const simulationConfig: StateMachineConfig<SimulationState, SimulationEvent, SimulationContext> = {
  states: ['IDLE', 'CONFIGURING', 'SIMULATING', 'BLAST_RADIUS_COMPUTED', 'ERROR'],
  initial: 'IDLE',
  transitions: {
    IDLE:                  { CONFIGURE: 'CONFIGURING' },
    CONFIGURING:           { RUN: 'SIMULATING', RESET: 'IDLE' },
    SIMULATING:            { COMPLETE: 'BLAST_RADIUS_COMPUTED', FAIL: 'ERROR' },
    BLAST_RADIUS_COMPUTED: { CONFIGURE: 'CONFIGURING', RESET: 'IDLE' },
    ERROR:                 { RESET: 'IDLE', CONFIGURE: 'CONFIGURING' },
  },
};

const simulationReducer = createMachineReducer(simulationConfig);

// ── Hook ──────────────────────────────────────────────────────────────

export interface SimulationMachineAPI {
  state: MachineState<SimulationState, SimulationContext>;
  send: (event: MachineAction<SimulationEvent>) => void;
  is: (s: SimulationState) => boolean;
  isConfiguring: boolean;
  isSimulating: boolean;
  hasResult: boolean;
  hasError: boolean;
}

export function useSimulationMachine(): SimulationMachineAPI {
  const [state, dispatch] = useReducer(
    simulationReducer,
    initialMachineState<SimulationState, SimulationContext>('IDLE', DEFAULT_CONTEXT),
  );

  return {
    state,
    send: dispatch,
    is: (s) => state.current === s,
    isConfiguring: state.current === 'CONFIGURING',
    isSimulating: state.current === 'SIMULATING',
    hasResult: state.current === 'BLAST_RADIUS_COMPUTED',
    hasError: state.current === 'ERROR',
  };
}
