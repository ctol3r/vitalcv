'use client';

/**
 * compoundActions.ts — Wave 130
 *
 * Typed compound action creators for multi-step trust operations.
 * Each returns an async thunk: (dispatch) => Promise<void>
 */

import type { MachineAction } from './types';
import type { WalletEvent } from './walletMachine';
import type { VerifierEvent } from './verifierMachine';
import type { SimulationEvent } from './simulationMachine';

type Dispatch<E extends string> = (action: MachineAction<E>) => void;

// ── Wallet: present credential flow ───────────────────────────────────

/**
 * Sequences wallet machine events for a full selective disclosure presentation.
 * Caller provides the actual API call as `presentFn`.
 */
export function presentCredentialFlow(
  credentialId: string,
  claims: string[],
  presentFn: (id: string, claims: string[]) => Promise<void>,
) {
  return async (dispatch: Dispatch<WalletEvent>): Promise<void> => {
    dispatch({ type: 'SELECT_CREDENTIAL', payload: credentialId });
    claims.forEach(() => dispatch({ type: 'TOGGLE_CLAIM' }));
    dispatch({ type: 'SUBMIT' });
    try {
      await presentFn(credentialId, claims);
      dispatch({ type: 'SUBMIT_SUCCESS' });
    } catch (err) {
      dispatch({ type: 'SUBMIT_ERROR', payload: err instanceof Error ? err.message : 'Unknown error' });
    }
  };
}

// ── Verifier: accept verification flow ────────────────────────────────

/**
 * Sequences verifier machine events for reviewing and accepting a presentation.
 */
export function acceptVerificationFlow(
  presentationId: string,
  acceptFn: (id: string) => Promise<void>,
) {
  return async (dispatch: Dispatch<VerifierEvent>): Promise<void> => {
    dispatch({ type: 'START_REVIEW', payload: presentationId });
    dispatch({ type: 'ACCEPT' });
    try {
      await acceptFn(presentationId);
      dispatch({ type: 'CONFIRM' });
    } catch (err) {
      dispatch({ type: 'ERROR_OCCURRED', payload: err instanceof Error ? err.message : 'Unknown error' });
    }
  };
}

// ── Simulation: blast radius flow ─────────────────────────────────────

/**
 * Sequences simulation machine events for a blast radius computation.
 */
export function runBlastRadiusFlow(
  npi: string,
  simulateFn: (npi: string) => Promise<void>,
) {
  return async (dispatch: Dispatch<SimulationEvent>): Promise<void> => {
    dispatch({ type: 'CONFIGURE', payload: npi });
    dispatch({ type: 'RUN' });
    try {
      await simulateFn(npi);
      dispatch({ type: 'COMPLETE' });
    } catch (err) {
      dispatch({ type: 'FAIL', payload: err instanceof Error ? err.message : 'Unknown error' });
    }
  };
}
