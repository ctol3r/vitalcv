/**
 * MB0 — qualified-start measurement.
 *
 * Measures the span the market never sells: **offer accepted → first billable**.
 * The competitive study (docs/research/competitor-message-brand-study-2026-07-26.md
 * §9.1) found every vendor prices one HALF of this clock — hiring vendors stop at
 * offer acceptance, credentialing vendors start there — and that even symplr, which
 * owns both an ATS and a CVO, never publishes the joined span. Measuring it is what
 * turns "get hired faster, start working faster" from a promise into a citable fact.
 *
 * This module is deliberately NOT `time-to-start-estimate.ts`. That module projects a
 * range from a hardcoded 90-day baseline and hand-tuned coefficients, and reports a
 * `timeSavedDays` range. Useful as a conversation anchor, but it is an assumption.
 * This module is the opposite discipline:
 *
 *   - No baseline. No coefficients. No penalties. Only measured deltas between
 *     timestamps the system actually recorded.
 *   - An incomplete span yields `null` days and `complete: false`. It never guesses,
 *     never interpolates, never falls back to a baseline.
 *   - **No `timeSaved` output at all.** "Saved" requires a counterfactual — what this
 *     clinician's start would have been without VitalCV — and we do not observe that.
 *     Emitting a saved-days number from a one-armed measurement would be exactly the
 *     unattached-percentage failure mode the study documents across 28 competitors.
 *   - Cohort aggregates report how many spans they EXCLUDED, so an average can never
 *     be quietly computed over partial data.
 *
 * Pure transforms only: no fetches, no DB writes, no audit-event writes.
 */

/** Milestones on the joined clock, in the order they occur. */
export type QualifiedStartMilestone =
  | 'offer_accepted'
  | 'evidence_reused'
  | 'requirement_cleared'
  | 'start_confirmed'
  | 'first_billable';

export interface QualifiedStartEvent {
  /** Groups events belonging to one clinician↔employer engagement. */
  engagementId: string;
  milestone: QualifiedStartMilestone;
  /** ISO-8601 instant the milestone occurred. */
  occurredAt: string;
  /** Source lane ids reused from existing evidence (no re-verification needed). */
  reusedSourceIds?: string[];
  /** Source lane ids that had to be verified again for this engagement. */
  reverifiedSourceIds?: string[];
}

/** Why a span could not produce a measured duration. */
export type QualifiedStartIncompleteReason =
  | 'no_offer_accepted'
  | 'no_terminal_milestone'
  | 'terminal_before_offer';

export interface QualifiedStartReuse {
  reusedCount: number;
  reverifiedCount: number;
  /**
   * Reused ÷ (reused + reverified), or `null` when nothing was observed —
   * distinct from a real 0, which means everything had to be re-verified.
   */
  reuseRatio: number | null;
}

export interface QualifiedStartSpan {
  engagementId: string;
  offerAcceptedAt: string | null;
  startConfirmedAt: string | null;
  firstBillableAt: string | null;
  /**
   * Measured days from offer accepted to the terminal milestone.
   * `null` whenever the span is incomplete — never a guess.
   */
  qualifiedStartDays: number | null;
  /** Which milestone ended the measurement (`first_billable` preferred). */
  terminalMilestone: Extract<QualifiedStartMilestone, 'start_confirmed' | 'first_billable'> | null;
  requirementsCleared: number;
  reuse: QualifiedStartReuse;
  complete: boolean;
  incompleteReason: QualifiedStartIncompleteReason | null;
}

const MS_PER_DAY = 86_400_000;

/**
 * Minimum complete spans before a cohort aggregate may be shown anywhere public.
 * The study's specificity ladder (§Arena 3 pattern 3) is explicit that speaking one
 * rung above your data is where dishonesty starts; a mean over two engagements is
 * not a company claim.
 */
export const MIN_PUBLISHABLE_COHORT_SIZE = 12;

function parseInstant(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Earliest valid occurrence of a milestone, or null. */
function earliestInstant(events: QualifiedStartEvent[], milestone: QualifiedStartMilestone): number | null {
  let earliest: number | null = null;

  for (const event of events) {
    if (event.milestone !== milestone) continue;
    const instant = parseInstant(event.occurredAt);
    if (instant === null) continue;
    if (earliest === null || instant < earliest) {
      earliest = instant;
    }
  }

  return earliest;
}

function countReuse(events: QualifiedStartEvent[]): QualifiedStartReuse {
  const reused = new Set<string>();
  const reverified = new Set<string>();

  for (const event of events) {
    for (const id of event.reusedSourceIds ?? []) {
      const normalized = id.trim();
      if (normalized) reused.add(normalized);
    }
    for (const id of event.reverifiedSourceIds ?? []) {
      const normalized = id.trim();
      if (normalized) reverified.add(normalized);
    }
  }

  // A lane that was re-verified is not also a reuse, even if both were logged.
  for (const id of reverified) {
    reused.delete(id);
  }

  const observed = reused.size + reverified.size;

  return {
    reusedCount: reused.size,
    reverifiedCount: reverified.size,
    reuseRatio: observed === 0 ? null : reused.size / observed,
  };
}

/**
 * Derive one engagement's measured span. Pure: same events in, same span out.
 * Events may arrive in any order and may contain unparseable timestamps; both are
 * handled without inventing a duration.
 */
export function deriveQualifiedStartSpan(
  engagementId: string,
  events: QualifiedStartEvent[],
): QualifiedStartSpan {
  const scoped = events.filter((event) => event.engagementId === engagementId);
  const reuse = countReuse(scoped);
  const requirementsCleared = scoped.filter(
    (event) => event.milestone === 'requirement_cleared' && parseInstant(event.occurredAt) !== null,
  ).length;

  const offerAccepted = earliestInstant(scoped, 'offer_accepted');
  const startConfirmed = earliestInstant(scoped, 'start_confirmed');
  const firstBillable = earliestInstant(scoped, 'first_billable');

  const base: QualifiedStartSpan = {
    engagementId,
    offerAcceptedAt: offerAccepted === null ? null : new Date(offerAccepted).toISOString(),
    startConfirmedAt: startConfirmed === null ? null : new Date(startConfirmed).toISOString(),
    firstBillableAt: firstBillable === null ? null : new Date(firstBillable).toISOString(),
    qualifiedStartDays: null,
    terminalMilestone: null,
    requirementsCleared,
    reuse,
    complete: false,
    incompleteReason: null,
  };

  if (offerAccepted === null) {
    return { ...base, incompleteReason: 'no_offer_accepted' };
  }

  // first_billable is the true end of the joined clock; start_confirmed is the
  // fallback for employers who do not report billing.
  const terminalMilestone = firstBillable !== null ? 'first_billable' : startConfirmed !== null ? 'start_confirmed' : null;
  const terminalInstant = firstBillable ?? startConfirmed;

  if (terminalMilestone === null || terminalInstant === null) {
    return { ...base, incompleteReason: 'no_terminal_milestone' };
  }

  if (terminalInstant < offerAccepted) {
    // Clock-skew or mis-sequenced ingest. Refuse rather than emit a negative span.
    return { ...base, terminalMilestone, incompleteReason: 'terminal_before_offer' };
  }

  return {
    ...base,
    qualifiedStartDays: (terminalInstant - offerAccepted) / MS_PER_DAY,
    terminalMilestone,
    complete: true,
    incompleteReason: null,
  };
}

/** Derive every engagement present in the event stream. */
export function deriveQualifiedStartSpans(events: QualifiedStartEvent[]): QualifiedStartSpan[] {
  const engagementIds: string[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    const id = event.engagementId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    engagementIds.push(id);
  }

  return engagementIds.map((id) => deriveQualifiedStartSpan(id, events));
}

export interface QualifiedStartCohort {
  /** Spans that produced a measured duration. */
  measuredSpans: number;
  /** Spans deliberately excluded for incompleteness — never silently dropped. */
  excludedIncomplete: number;
  medianDays: number | null;
  meanDays: number | null;
  minimumDays: number | null;
  maximumDays: number | null;
  /** Mean reuse ratio across measured spans that observed any source lanes. */
  meanReuseRatio: number | null;
  /** False until `measuredSpans >= MIN_PUBLISHABLE_COHORT_SIZE`. */
  publishable: boolean;
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Summarize a cohort over COMPLETE spans only, always reporting the exclusion count.
 * `publishable` is the gate MB7 asserts against: no marketing surface may render a
 * cohort number while this is false.
 */
export function summarizeQualifiedStartCohort(spans: QualifiedStartSpan[]): QualifiedStartCohort {
  const measured = spans.filter(
    (span): span is QualifiedStartSpan & { qualifiedStartDays: number } =>
      span.complete && typeof span.qualifiedStartDays === 'number',
  );
  const excludedIncomplete = spans.length - measured.length;

  if (measured.length === 0) {
    return {
      measuredSpans: 0,
      excludedIncomplete,
      medianDays: null,
      meanDays: null,
      minimumDays: null,
      maximumDays: null,
      meanReuseRatio: null,
      publishable: false,
    };
  }

  const days = measured.map((span) => span.qualifiedStartDays).sort((a, b) => a - b);
  const ratios = measured
    .map((span) => span.reuse.reuseRatio)
    .filter((ratio): ratio is number => ratio !== null);

  return {
    measuredSpans: measured.length,
    excludedIncomplete,
    medianDays: median(days),
    meanDays: days.reduce((total, value) => total + value, 0) / days.length,
    minimumDays: days[0],
    maximumDays: days[days.length - 1],
    meanReuseRatio:
      ratios.length === 0 ? null : ratios.reduce((total, value) => total + value, 0) / ratios.length,
    publishable: measured.length >= MIN_PUBLISHABLE_COHORT_SIZE,
  };
}
