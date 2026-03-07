/**
 * state-machines/types.ts — Wave 130: Typed State Machine Infrastructure
 *
 * A minimal, React-native state machine system using useReducer.
 * No external deps — pure TypeScript + React.
 */

/** Generic state machine configuration */
export interface StateMachineConfig<
  S extends string,
  E extends string,
  C = unknown,
> {
  /** All valid states */
  states: readonly S[];
  /** Starting state */
  initial: S;
  /** Transition table: state → event → next state */
  transitions: Partial<Record<S, Partial<Record<E, S>>>>;
  /** Optional guards: event → (context) => boolean — false blocks transition */
  guards?: Partial<Record<E, (context: C) => boolean>>;
}

/** Runtime machine state */
export interface MachineState<S extends string, C = unknown> {
  current: S;
  context: C;
  history: S[];
}

/** Action dispatched to the machine */
export interface MachineAction<E extends string, P = unknown> {
  type: E;
  payload?: P;
}

/** Reducer produced by createMachine */
export type MachineReducer<S extends string, E extends string, C = unknown> = (
  state: MachineState<S, C>,
  action: MachineAction<E>,
) => MachineState<S, C>;

/**
 * Create a typed reducer for a state machine config.
 * Unrecognised transitions are silently ignored (state unchanged).
 */
export function createMachineReducer<S extends string, E extends string, C = unknown>(
  config: StateMachineConfig<S, E, C>,
): MachineReducer<S, E, C> {
  return (state, action) => {
    const next = config.transitions[state.current]?.[action.type];
    if (!next) return state; // no transition defined — stay put

    const guard = config.guards?.[action.type];
    if (guard && !guard(state.context)) return state; // guard blocked transition

    return {
      current: next,
      context: state.context,
      history: [...state.history.slice(-9), state.current], // keep last 10
    };
  };
}

/** Convenience: initial MachineState from config */
export function initialMachineState<S extends string, C = unknown>(
  initial: S,
  context: C,
): MachineState<S, C> {
  return { current: initial, context, history: [] };
}
