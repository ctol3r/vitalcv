/**
 * FOUNDATION-SWEEP-3 — degraded-state foundation policy.
 *
 * Truth invariants:
 *   - Offline sync is NOT implemented. The "offline" degraded state
 *     keeps work in a local draft only; it does not transparently
 *     synchronise on reconnect.
 *   - A source outage is NEVER a clinician defect. The
 *     "source_probe_unknown" / "upstream_unavailable" states surface
 *     the source-health classifier's findings, not a holder-quality
 *     signal.
 *   - Each state carries a user-safe explanation + a retry-or-not
 *     hint. Raw error payloads / stack traces / secrets must not
 *     appear in any notice produced here.
 */

export type DegradedStateKind =
  | 'offline'
  | 'upstream_unavailable'
  | 'upload_failed'
  | 'source_probe_unknown'
  | 'retry_required'
  | 'local_draft_only';

export interface DegradedStateNotice {
  kind: DegradedStateKind;
  /** UI heading for the notice (≤ 64 chars). */
  heading: string;
  /** User-safe body text; never includes raw payload / stack / secret. */
  body: string;
  /** Recommended next action the holder can take. */
  remediation: string;
  /** Whether retrying the same action might succeed. */
  retryable: boolean;
}

export interface DegradedStatePolicy {
  /** Is offline sync implemented? Always false in this foundation. */
  offlineSyncImplemented: false;
  /** Whether a source outage produces a clinician-defect signal. Always false. */
  sourceOutageIsClinicianDefect: false;
  notices: DegradedStateNotice[];
  /** UI disclaimers rendered verbatim. */
  disclaimers: string[];
}

const OFFLINE_SYNC_DISCLAIMER =
  'Offline sync is not implemented. Working without a connection stays in a local draft until you reconnect.';
const SOURCE_OUTAGE_DISCLAIMER =
  'A source outage is a property of the upstream source, not a defect of the clinician. Lane state never changes a credential decision on its own.';

const NOTICES: DegradedStateNotice[] = [
  {
    kind: 'offline',
    heading: "You're offline",
    body: 'No network connection detected. Your changes are kept as a local draft and are not synced.',
    remediation: 'Reconnect to a stable network, then submit again.',
    retryable: true,
  },
  {
    kind: 'upstream_unavailable',
    heading: 'Upstream source unavailable',
    body: 'A source-of-record check (NPPES / OIG / PECOS / state board) returned an unavailable state.',
    remediation: 'Try again later; the source-health classifier will retry on its schedule.',
    retryable: true,
  },
  {
    kind: 'upload_failed',
    heading: 'Upload did not complete',
    body: 'A file upload was interrupted before it finished.',
    remediation: 'Reselect the file and try again. If the problem persists, switch to a different network.',
    retryable: true,
  },
  {
    kind: 'source_probe_unknown',
    heading: 'Source health unknown',
    body: 'No recent source-health snapshot is available for one or more lanes. This is not a credential decision.',
    remediation: 'Wait for the next scheduled probe; no holder action is required.',
    retryable: false,
  },
  {
    kind: 'retry_required',
    heading: 'Retry required',
    body: 'A transient error prevented the request from completing.',
    remediation: 'Wait a moment and try again.',
    retryable: true,
  },
  {
    kind: 'local_draft_only',
    heading: 'Local draft only',
    body: 'This entry is kept on your device and has not been submitted.',
    remediation: 'Open the entry and submit when you are ready.',
    retryable: true,
  },
];

export function buildDegradedStateFoundationPolicy(): DegradedStatePolicy {
  return {
    offlineSyncImplemented: false,
    sourceOutageIsClinicianDefect: false,
    notices: NOTICES.map((n) => ({ ...n })),
    disclaimers: [OFFLINE_SYNC_DISCLAIMER, SOURCE_OUTAGE_DISCLAIMER],
  };
}

export function explainDegradedState(kind: DegradedStateKind): DegradedStateNotice {
  const notice = NOTICES.find((n) => n.kind === kind);
  if (!notice) {
    throw new Error(`Unknown degraded state kind: ${kind}`);
  }
  return { ...notice };
}
