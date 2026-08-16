/**
 * Friction telemetry — MF-WAVE-01: definitions + a pure recorder ONLY.
 *
 * NOTHING EMITS IN THIS WAVE. This module deliberately does not import
 * posthog-js, is not a client module, and is wired to no UI and no route. It
 * defines the friction measurement vocabulary (Minimum Friction thesis §29 /
 * docs/minimum-friction/MINIMUM_FRICTION_USER_JOURNEY.md §6) and a pure
 * recorder a later, separately-reviewed wave may connect to the funnel.
 *
 * Discipline inherited from the funnel (funnel.ts and the pinned allowlist in
 * __tests__/funnel-instrumentation.test.ts):
 * - STAGE-ONLY. Event properties carry stage metadata and counts — never an
 *   NPI (raw or hashed: a SHA-256 of a 10-digit number is brute-forceable, so
 *   hashing is not anonymisation), never a name, never credential detail.
 *   This recorder enforces that structurally: property values must be
 *   `number | null`. There is no string channel to smuggle PII through.
 * - PINNED ALLOWLIST. Only the keys below are recordable; an unknown key is
 *   rejected, not silently dropped. Do not widen the funnel's own allowlist.
 * - UNKNOWN STAYS `null`. "We did not measure this" is distinct from "this is
 *   zero"; zero and unknown are BOTH valid measurements and neither is ever
 *   imputed from the other.
 * - NO CLOCK READS. Time is injected; the recorder never calls Date.now().
 */

// ── Stage vocabulary ────────────────────────────────────────────────

export const FRICTION_STAGES = {
  MOVE_STARTED: 'friction_move_started',
  QUESTION_PRESENTED: 'friction_question_presented',
  QUESTION_SUPPRESSED: 'friction_question_suppressed',
  DOCUMENT_REQUESTED: 'friction_document_requested',
  SOURCE_QUERY_RECORDED: 'friction_source_query_recorded',
  SHARE_PREVIEWED: 'friction_share_previewed',
  MOVE_COMPLETED: 'friction_move_completed',
} as const;

export type FrictionStageName =
  (typeof FRICTION_STAGES)[keyof typeof FRICTION_STAGES];

// ── Pinned property allowlist (stage metadata + counts only) ────────

export const FRICTION_PROPERTY_ALLOWLIST = [
  /** 1 = first move, 2 = second move, … */
  'move_index',
  'clinician_actions',
  'sensitive_attributes_collected',
  'documents_requested',
  'disclosed_attributes',
  'source_queries',
  'human_reviews',
  // Second-move reuse deltas (USER_JOURNEY §6). Null until a prior move exists.
  'fields_not_reentered',
  'evidence_not_recollected',
  'source_queries_avoided',
  'documents_not_reuploaded',
  'time_delta_ms',
] as const;

export type FrictionPropertyKey = (typeof FRICTION_PROPERTY_ALLOWLIST)[number];

/**
 * One move's friction measurement. Every field is `number | null`: null means
 * "not measured", never zero, and zero means a measured zero, never a default.
 */
export type FrictionMoveMeasurement = Record<FrictionPropertyKey, number | null>;

export interface FrictionTelemetryEvent {
  readonly stage: FrictionStageName;
  /** Millisecond timestamp from the INJECTED clock. */
  readonly at: number;
  readonly properties: Readonly<Partial<Record<FrictionPropertyKey, number | null>>>;
}

// ── Pure recorder ───────────────────────────────────────────────────

export interface FrictionRecorder {
  /**
   * Records one stage observation. Throws on any key outside the pinned
   * allowlist and on any non-`number | null` value — fail closed; a recorder
   * that silently dropped a key would hide the defect that sent it.
   */
  record(
    stage: FrictionStageName,
    properties?: Partial<Record<FrictionPropertyKey, number | null>>,
  ): void;
  /** Every recorded event, in record order. */
  events(): readonly FrictionTelemetryEvent[];
  /**
   * The move's measurement: for each allowlisted key, the LAST explicitly
   * recorded value, else null. `time_delta_ms` is additionally derived from
   * the injected clock when both MOVE_STARTED and MOVE_COMPLETED were
   * recorded and no explicit value was supplied.
   */
  measure(): FrictionMoveMeasurement;
}

const STAGE_NAMES: ReadonlySet<string> = new Set(Object.values(FRICTION_STAGES));
const ALLOWLIST: ReadonlySet<string> = new Set(FRICTION_PROPERTY_ALLOWLIST);

export interface CreateFrictionRecorderInput {
  /** 1 = first move, 2 = second move, … */
  readonly moveIndex: number;
  /** The injected clock (milliseconds). The recorder never reads real time. */
  readonly now: () => number;
}

export function createFrictionRecorder(
  input: CreateFrictionRecorderInput,
): FrictionRecorder {
  const events: FrictionTelemetryEvent[] = [];

  return {
    record(stage, properties = {}) {
      if (!STAGE_NAMES.has(stage)) {
        throw new Error(`Unknown friction stage: ${String(stage)}`);
      }
      for (const [key, value] of Object.entries(properties)) {
        if (!ALLOWLIST.has(key)) {
          throw new Error(
            `Friction property ${JSON.stringify(key)} is not on the pinned allowlist; ` +
              'stage metadata and counts only — never PII.',
          );
        }
        if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
          throw new Error(
            `Friction property ${JSON.stringify(key)} must be a finite number or null; ` +
              'there is no string channel in friction telemetry.',
          );
        }
      }
      events.push({ stage, at: input.now(), properties: { ...properties } });
    },

    events() {
      return [...events];
    },

    measure() {
      const measurement = {} as Record<FrictionPropertyKey, number | null>;
      for (const key of FRICTION_PROPERTY_ALLOWLIST) {
        measurement[key] = null;
      }
      measurement.move_index = input.moveIndex;

      let startedAt: number | null = null;
      let completedAt: number | null = null;
      let explicitTimeDelta = false;

      for (const event of events) {
        if (event.stage === FRICTION_STAGES.MOVE_STARTED) startedAt = event.at;
        if (event.stage === FRICTION_STAGES.MOVE_COMPLETED) completedAt = event.at;
        for (const [key, value] of Object.entries(event.properties)) {
          if (value === undefined) continue;
          measurement[key as FrictionPropertyKey] = value;
          if (key === 'time_delta_ms') explicitTimeDelta = true;
        }
      }

      if (!explicitTimeDelta && startedAt !== null && completedAt !== null) {
        measurement.time_delta_ms = completedAt - startedAt;
      }
      return measurement;
    },
  };
}
