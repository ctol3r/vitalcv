/**
 * STUB: Demo flow documentation only.
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
 * STUB: Describes a demo step without runtime logic.
 * TODO: Populate labels and copy from live UX content.
 */
export interface DemoStep {
  state: DemoState;
  title: string;
  summary: string;
}

/**
 * Transition stubs (no logic):
 * - INTRO -> ISSUANCE (TODO: wire start trigger)
 * - ISSUANCE -> PRESENTATION (TODO: wire issuance completion)
 * - PRESENTATION -> VERIFICATION (TODO: wire presentation submission)
 * - VERIFICATION -> COMPLETE (TODO: wire verification outcome)
 */
