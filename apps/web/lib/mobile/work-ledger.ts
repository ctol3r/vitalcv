/**
 * work-ledger — the honest event feed for the clinician home (A3).
 *
 * The audit plan (2026-08-08, A3 work item 4) wants agent activity treated as
 * a ledger of REAL events, each carrying an owner-state word, a consequence,
 * and a time. EC-7 preserves the controller; EC-8 bounds the state family.
 *
 * Truth rule: an entry is minted only from a recorded fact already in
 * ClinicianMobileData — a notification, a readiness-history row, or an
 * application timeline stage. Nothing here invents agency: "VitalCV did it"
 * is reserved for events that genuinely record VitalCV's own completed work
 * (readiness recomputation from returned evidence); everything else is
 * "Something changed" or "Employer decides". No fixture path, no optimism.
 */

import type { ClinicianMobileData } from '@/lib/mobile/clinician-state';

export type LedgerState =
  | 'did' // VitalCV did it
  | 'prepared' // VitalCV prepared it (unused until a real prepared-action source exists)
  | 'employer' // Employer decides
  | 'changed' // Something changed
  | 'finished'; // Finished

export interface LedgerEntry {
  id: string;
  state: LedgerState;
  /** The owner-state word, rendered next to the glyph (EC-4: glyph + word). */
  word: string;
  title: string;
  /** One-line consequence — what this means for the clinician, not system state. */
  consequence: string;
  /** ISO timestamp of the recorded event; entries without one are excluded. */
  occurredAt: string;
  href: string | null;
}

const STATE_WORDS: Record<LedgerState, string> = {
  did: 'VitalCV did it',
  prepared: 'VitalCV prepared it',
  employer: 'Employer decides',
  changed: 'Something changed',
  finished: 'Finished',
};

function entry(
  partial: Omit<LedgerEntry, 'word'> & { state: LedgerState },
): LedgerEntry {
  return { ...partial, word: STATE_WORDS[partial.state] };
}

/**
 * Application statuses where the matter genuinely rests with the employer
 * (EC-7: "Employer decides" only when the employer actually decides).
 */
const EMPLOYER_COURT = new Set(['REVIEWED', 'SUBMITTED', 'IN_REVIEW', 'PENDING_REVIEW']);

export function buildWorkLedger(data: ClinicianMobileData, limit = 6): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  for (const notification of data.notifications) {
    if (!notification.occurredAt) continue;
    // A missing item is a STANDING state, not an event: those notifications
    // are minted client-side from the blocker list and stamped with the
    // request clock, so rendering them here would show "Something changed ·
    // just now" for facts that have been true since signup — and duplicate
    // the Waiting section. Standing states render once, under Waiting.
    if (notification.type === 'missing_item_detected') continue;
    const employerEvent =
      notification.type === 'application_status_changed' && notification.relatedApplicationId;
    entries.push(
      entry({
        id: `notification:${notification.id}`,
        state: employerEvent ? 'employer' : 'changed',
        title: notification.title,
        consequence: notification.body,
        occurredAt: notification.occurredAt,
        href: notification.href ?? null,
      }),
    );
  }

  for (const row of data.trustHistory) {
    if (!row.computedAt) continue;
    const resolved = row.resolvedGaps?.length ?? 0;
    entries.push(
      entry({
        id: `readiness:${row.id}`,
        // DL-007 honest verbs: a readiness recomputation is an observation of
        // the clinician's own evidence, not VitalCV acting on their behalf —
        // so it is "Something changed", never "VitalCV did it". The did/
        // prepared states stay reserved for real Agent* events, which have no
        // read endpoint yet (recorded product dependency, A3).
        state: 'changed',
        title:
          resolved > 0
            ? `Readiness recomputed — ${row.resolvedGaps.slice(0, 2).join(', ')} resolved`
            : 'Readiness recomputed from your evidence',
        consequence: row.reason
          ? row.reason
          : row.deltaScore !== null && row.deltaScore !== undefined
            ? `Recorded change: ${row.deltaScore >= 0 ? '+' : ''}${row.deltaScore} from the prior computation`
            : 'No change against the prior computation',
        occurredAt: row.computedAt,
        href: '/holder/readiness',
      }),
    );
  }

  for (const application of data.activeApplications) {
    const latest = application.timeline?.[application.timeline.length - 1];
    if (!latest?.occurredAt) continue;
    const inEmployerCourt = EMPLOYER_COURT.has(application.status);
    entries.push(
      entry({
        id: `application:${application.id}:${latest.stage}`,
        state:
          application.status === 'ACCEPTED' || application.status === 'COMPLETED'
            ? 'finished'
            : inEmployerCourt
              ? 'employer'
              : 'changed',
        title: `${application.opportunity?.title ?? 'Your application'} — ${latest.stage.toLowerCase().replace(/_/g, ' ')}`,
        consequence:
          latest.description ??
          (inEmployerCourt
            ? `${application.employer?.name ?? 'The employer'} holds the next move.`
            : 'Recorded application update.'),
        occurredAt: latest.occurredAt,
        href: `/holder/applications/${encodeURIComponent(application.id)}`,
      }),
    );
  }

  return entries
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, limit);
}
