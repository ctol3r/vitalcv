/**
 * STUB: Demo flow contracts only.
 * TODO: Wire to live demo state orchestration.
 */

export enum DemoState {
  INTRO = 'INTRO',
  ISSUANCE = 'ISSUANCE',
  PRESENTATION = 'PRESENTATION',
  VERIFICATION = 'VERIFICATION',
  COMPLETE = 'COMPLETE',
}

/**
 * STUB: Demo step contract.
 * TODO: Bind to live copy and transitions.
 */
export interface DemoStep {
  state: DemoState;
  title: string;
  summary: string;
}

/**
 * Transition stubs (no logic):
 * - INTRO -> ISSUANCE (TODO: start trigger)
 * - ISSUANCE -> PRESENTATION (TODO: issuance completion)
 * - PRESENTATION -> VERIFICATION (TODO: presentation submission)
 * - VERIFICATION -> COMPLETE (TODO: verification outcome)
 */
