/**
 * Longitudinal Career Model (Wave 1000, C3)
 * ──────────────────────────────────────────────────────────────────────────
 * A decades-spanning, immutable view of a career derived from the timeline and
 * the growth milestones. "Immutable" here is a derivation property: events and
 * milestones are reduced — never mutated — from the source evidence, and grouped
 * into chronological eras. "Versioned evidence" is carried by the model's
 * contentHash (in career.ts): the same evidence always yields the same record.
 *
 * The `legacy` tail is the earliest era — the foundational history that anchors
 * a clinician's long career (Education → … → Legacy in the C6 chain).
 *
 * Pure: no clock. Eras are computed from the events' own dates; undated events
 * collect into a single `undated` bucket so nothing is silently dropped.
 */
import type { CareerEvent } from '../timeline/timeline';
import type { Milestone } from '../growth/growth';

/** A decade-aligned slice of a career (e.g. the 2010s). */
export interface CareerEra {
  /** e.g. "2010s", or "Undated" for events with no date. */
  label: string;
  /** Decade start year (inclusive), or null for the undated bucket. */
  startYear: number | null;
  /** Decade end year (inclusive), or null for the undated bucket. */
  endYear: number | null;
  /** Events in this era, chronological (undated last). */
  events: CareerEvent[];
}

export interface CareerLongitudinal {
  subjectKey: string;
  firstAt: string | null;
  lastAt: string | null;
  /** Whole career span in years (first→last), or null if not datable. */
  spanYears: number | null;
  /** Immutable milestones (derived from decision-relevant growth evidence). */
  milestones: Milestone[];
  /** Decade-aligned eras, oldest → newest, undated bucket last. */
  eras: CareerEra[];
  /** The earliest dated era — foundational career history. */
  legacy: CareerEra | null;
}

function yearOf(iso: string | null): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : null;
}

function decadeStart(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** Chronological compare; nulls (undated) sort last. */
function byOccurredAt(a: CareerEvent, b: CareerEvent): number {
  if (a.occurredAt === b.occurredAt) return a.eventId.localeCompare(b.eventId);
  if (a.occurredAt === null) return 1;
  if (b.occurredAt === null) return -1;
  return a.occurredAt < b.occurredAt ? -1 : 1;
}

/**
 * Build the longitudinal record. Groups timeline events into decade eras and
 * surfaces the immutable milestone set. Deterministic for a given input.
 */
export function projectCareerLongitudinal(
  timeline: { subjectKey: string; events: CareerEvent[]; firstAt: string | null; lastAt: string | null },
  milestones: Milestone[],
): CareerLongitudinal {
  const sorted = [...timeline.events].sort(byOccurredAt);

  const datedByDecade = new Map<number, CareerEvent[]>();
  const undated: CareerEvent[] = [];
  for (const event of sorted) {
    const year = yearOf(event.occurredAt);
    if (year === null) {
      undated.push(event);
      continue;
    }
    const decade = decadeStart(year);
    const bucket = datedByDecade.get(decade);
    if (bucket) bucket.push(event);
    else datedByDecade.set(decade, [event]);
  }

  const eras: CareerEra[] = [...datedByDecade.keys()]
    .sort((a, b) => a - b)
    .map((decade) => ({
      label: `${decade}s`,
      startYear: decade,
      endYear: decade + 9,
      events: datedByDecade.get(decade)!,
    }));

  if (undated.length > 0) {
    eras.push({ label: 'Undated', startYear: null, endYear: null, events: undated });
  }

  const firstYear = yearOf(timeline.firstAt);
  const lastYear = yearOf(timeline.lastAt);
  const spanYears = firstYear !== null && lastYear !== null ? Math.max(0, lastYear - firstYear) : null;

  // Legacy = earliest DATED era (undated bucket is never the legacy anchor).
  const legacy = eras.find((e) => e.startYear !== null) ?? null;

  return {
    subjectKey: timeline.subjectKey,
    firstAt: timeline.firstAt,
    lastAt: timeline.lastAt,
    spanYears,
    milestones,
    eras,
    legacy,
  };
}
