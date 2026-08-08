/**
 * A2.3 — deriving deadlines from consumed truth.
 *
 * ## What A2.3 can and cannot honestly classify
 *
 * `vitalcv_policy` deadlines are derivable today and unambiguous: a lane's
 * `freshnessWindowDays` is our preference by definition, so `observedAt +
 * window` is our date and is labelled as such.
 *
 * `source_set` deadlines are modelled and honoured, but the current web
 * reader path cannot produce one. The canonical coverage layer's `expiresAt`
 * is built as *either* a source-published value *or* `observedAt +
 * freshnessWindowHours`, and the two are indistinguishable in the output
 * (`buildCanonicalSourceCoverageFreshness`). Reading it as `source_set`
 * would relabel our own policy as the authority's fact — the exact failure
 * §8 exists to prevent — so a source-set expiry only enters the context
 * through `SourceObservationState.sourceExpiresAt`, which a reader may set
 * only from a channel that preserves provenance.
 *
 * That field is populated by bench fixtures today and by the licensure
 * observation path when it goes live. Nothing infers it.
 */
import type { StartAgentContext } from '../types';
import { urgencyFor, type BlockerUrgency, type Deadline } from './types';

/** Every deadline the consumed context supports, each with its provenance. */
export function deriveDeadlines(context: StartAgentContext): Deadline[] {
  const deadlines: Deadline[] = [];

  for (const observation of context.observations) {
    // Source-set: only when the reader supplied one through a
    // provenance-preserving channel. Never inferred from coverage expiry.
    if (observation.sourceExpiresAt) {
      deadlines.push({
        provenance: 'source_set',
        at: observation.sourceExpiresAt,
        ref: observation.laneId,
        setBy: observation.authority,
      });
    }

    // VitalCV policy: our freshness preference, labelled as ours.
    if (observation.observedAt && observation.freshnessWindowDays) {
      const closesAt = new Date(
        Date.parse(observation.observedAt) + observation.freshnessWindowDays * 86_400_000,
      );
      if (!Number.isNaN(closesAt.getTime())) {
        deadlines.push({
          provenance: 'vitalcv_policy',
          at: closesAt.toISOString(),
          ref: observation.laneId,
          setBy: observation.authority,
        });
      }
    }
  }

  // Employer-set. `VcvOrganizationContext.dueAt` is the only employer-set
  // deadline that is actually written anywhere; `ActivationRequirement.dueAt`
  // is declared, read, and ordered by, but never populated, so nothing here
  // pretends otherwise.
  if (context.role?.employerDueAt) {
    deadlines.push({
      provenance: 'employer_set',
      at: context.role.employerDueAt,
      ref: context.role.roleRef,
      setBy: 'the employer',
    });
  }

  return deadlines.sort((a, b) =>
    a.at === b.at ? (a.ref < b.ref ? -1 : 1) : a.at < b.at ? -1 : 1,
  );
}

/**
 * The most pressing deadline for one ref, with its urgency.
 *
 * When a lane carries both a source-set end date and our own freshness
 * window, the SOURCE one wins on ties — it is the one that is actually about
 * the clinician's credential, and it is the sentence worth saying.
 */
export function urgencyForRef(
  deadlines: Deadline[],
  ref: string,
  now: string,
): BlockerUrgency | null {
  const candidates = deadlines
    .filter((d) => d.ref === ref)
    .map((deadline) => ({ deadline, level: urgencyFor(deadline, now) }))
    .filter((entry) => entry.level !== 'none');
  if (candidates.length === 0) return null;

  const rank = { passed: 3, imminent: 2, approaching: 1, none: 0 } as const;
  candidates.sort((a, b) => {
    if (rank[a.level] !== rank[b.level]) return rank[b.level] - rank[a.level];
    const aFactual = a.deadline.provenance === 'source_set' ? 0 : 1;
    const bFactual = b.deadline.provenance === 'source_set' ? 0 : 1;
    if (aFactual !== bFactual) return aFactual - bFactual;
    return a.deadline.at < b.deadline.at ? -1 : 1;
  });
  return { level: candidates[0].level, deadline: candidates[0].deadline };
}
