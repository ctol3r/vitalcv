/**
 * A2.3 — deadlines, with mandatory provenance.
 *
 * A deadline is a claim about the world and gets the same treatment as
 * evidence: it is never separable from who set it.
 *
 * The distinction that will be violated unless it is enforced structurally:
 *
 *   "Your license expires in 12 days."
 *   "Our preferred freshness window for this source closes in 12 days."
 *
 * Those are completely different sentences and only one of them is about the
 * clinician's license. The provenance class is what keeps them apart, and
 * `describeDeadline` is the only sanctioned way to turn one into words.
 *
 * A deadline never creates a blocker. It changes the URGENCY of an existing
 * one — which keeps the A0 blocker model intact and avoids a generic
 * "deadline" bucket, the same mistake as a generic `incomplete` flag.
 */

export const DEADLINE_PROVENANCE = [
  /** The authority published this date. May be stated as fact. */
  'source_set',
  /** The employer set this date. May be stated as fact. */
  'employer_set',
  /** VitalCV's own freshness preference. NEVER the clinician's deadline. */
  'vitalcv_policy',
  /** A projection. The qualifier must ride inside the rendered value. */
  'estimated',
] as const;
export type DeadlineProvenance = (typeof DEADLINE_PROVENANCE)[number];

export interface Deadline {
  provenance: DeadlineProvenance;
  /** ISO instant the deadline falls. */
  at: string;
  /** What it is about — a lane id, requirement id, or packet ref. */
  ref: string;
  /**
   * Who set it. For `source_set` this is the authority's name, and it is
   * what makes the rendered sentence attributable.
   */
  setBy: string;
  /** Required for `estimated`: the qualifier that must appear in any rendering. */
  qualifier?: string;
}

/**
 * How close a deadline is. The offsets are VitalCV policy about WHEN TO
 * MENTION something — which is a different and legitimate kind of policy
 * from inventing the date itself.
 */
export const URGENCY_LEVELS = ['none', 'approaching', 'imminent', 'passed'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const URGENCY_RANK: Record<UrgencyLevel, number> = {
  passed: 3,
  imminent: 2,
  approaching: 1,
  none: 0,
};

export const NOTICE_OFFSETS = { imminentDays: 14, approachingDays: 60 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function urgencyFor(deadline: Deadline, now: string): UrgencyLevel {
  const at = Date.parse(deadline.at);
  const from = Date.parse(now);
  if (Number.isNaN(at) || Number.isNaN(from)) return 'none';
  const days = (at - from) / DAY_MS;
  if (days < 0) return 'passed';
  if (days <= NOTICE_OFFSETS.imminentDays) return 'imminent';
  if (days <= NOTICE_OFFSETS.approachingDays) return 'approaching';
  return 'none';
}

export interface BlockerUrgency {
  level: UrgencyLevel;
  deadline: Deadline;
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * The ONLY sanctioned rendering of a deadline.
 *
 * Every branch names who set the date. The `vitalcv_policy` branch says so
 * twice — once by attribution and once by explicitly disclaiming that it is
 * the authority's date — because that is the sentence most likely to be
 * misread as a fact about the clinician's credential.
 */
export function describeDeadline(deadline: Deadline): string {
  const day = dayOf(deadline.at);
  switch (deadline.provenance) {
    case 'source_set':
      return `${deadline.setBy} records this as ending on ${day}.`;
    case 'employer_set':
      return `The employer set a due date of ${day}.`;
    case 'vitalcv_policy':
      return (
        `VitalCV's own preferred freshness window for ${deadline.setBy} closes on ${day}. `
        + `That is our preference for how recent a reading should be, not a date from the authority.`
      );
    case 'estimated':
      return `Estimated ${day}${deadline.qualifier ? ` — ${deadline.qualifier}` : ''} (an estimate, not a published date).`;
  }
}

/** True when this class of deadline may be stated as a plain fact. */
export function isFactualDeadline(provenance: DeadlineProvenance): boolean {
  return provenance === 'source_set' || provenance === 'employer_set';
}
