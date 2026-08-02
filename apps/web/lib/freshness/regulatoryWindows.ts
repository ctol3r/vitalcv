/**
 * Regulator-anchored freshness (W3).
 *
 * Evidence freshness is meaningful only against a real regulatory refresh
 * window — not an abstract TTL. This module pins the windows to the NCQA 2025
 * / CMS cadences the whole industry just adopted, and evaluates an evidence
 * item's age against its window with a 90/60/30-day escalation ladder and
 * consequence-naming copy.
 *
 * Pure + `now`-injected (no `Date.now()`) so it is deterministic and testable.
 * This is the honest counterpart to `packages/trust-contract/freshness-engine`
 * (an abstract TTL evaluator): here the window carries its regulatory basis.
 */

export type RegulatoryStandard = 'NCQA' | 'CMS' | 'internal';

export interface RegulatoryWindow {
  id: string;
  label: string;
  standard: RegulatoryStandard;
  /** Regulator citation, e.g. "NCQA CR.4". Absent for internal windows. */
  code?: string;
  /** Refresh SLA in whole days — the authoritative window. */
  windowDays: number;
  /** Human cadence phrase, e.g. "monthly", "every 90 days". */
  cadence: string;
  /** Why this window exists — the regulatory basis, shown on inspection. */
  rationale: string;
}

/**
 * The launch-spine windows, anchored to NCQA 2025 / CMS cadences. Values are
 * the tightened 2025 monitoring windows; primary-source verification uses the
 * 90-day CVO decision window (accredited orgs get 120 — noted in rationale).
 */
export const REGULATORY_WINDOWS = {
  sanctionScreening: {
    id: 'sanctionScreening',
    label: 'Sanction & exclusion screening',
    standard: 'NCQA',
    code: 'NCQA CR.5',
    windowDays: 30,
    cadence: 'monthly',
    rationale: 'OIG LEIE and state sanction sources are swept at least every 30 days between credentialing cycles.',
  },
  licenseMonitoring: {
    id: 'licenseMonitoring',
    label: 'License monitoring',
    standard: 'NCQA',
    code: 'NCQA CR.3',
    windowDays: 30,
    cadence: 'monthly',
    rationale: 'Active-license status is monitored monthly between full re-verification cycles.',
  },
  primarySourceVerification: {
    id: 'primarySourceVerification',
    label: 'Primary-source verification',
    standard: 'NCQA',
    code: 'NCQA CR.4',
    windowDays: 90,
    cadence: 'every 90 days',
    rationale: 'A credentialing decision must rest on primary-source verification within 90 days (120 for accredited organizations).',
  },
  boardCertification: {
    id: 'boardCertification',
    label: 'Board certification',
    standard: 'internal',
    windowDays: 365,
    cadence: 'annually',
    rationale: 'Board-certification status is re-confirmed annually.',
  },
} as const satisfies Record<string, RegulatoryWindow>;

export type RegulatoryWindowId = keyof typeof REGULATORY_WINDOWS;

/** Freshness tone against a regulatory window. */
export type FreshnessTone = 'current' | 'aging' | 'stale' | 'expired' | 'unknown';

/** 90/60/30-day escalation ladder (quiet → urgent). */
export type FreshnessEscalation = 'none' | 'notice' | 'warning' | 'urgent';

export interface RegulatoryFreshness {
  tone: FreshnessTone;
  /** Whole-day age of the observation; `null` when never checked. */
  ageDays: number | null;
  /** windowDays − age; negative once past the window; `null` when unchecked. */
  remainingDays: number | null;
  /** ISO date (YYYY-MM-DD) the next refresh is due; `null` when unchecked. */
  nextDueAt: string | null;
  escalation: FreshnessEscalation;
  /** Consequence-naming copy — what this state blocks / requires. */
  consequence: string;
  windowDays: number;
  code?: string;
}

const DAY_MS = 86_400_000;

function wholeDaysBetween(laterMs: number, earlierMs: number): number {
  return Math.floor((laterMs - earlierMs) / DAY_MS);
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function buildConsequence(
  tone: FreshnessTone,
  remainingDays: number | null,
  nextDueAt: string | null,
  window: RegulatoryWindow,
): string {
  const cite = window.code ? ` (${window.code})` : '';
  switch (tone) {
    case 'current':
      return `Current — next ${window.cadence} refresh due ${nextDueAt}${cite}.`;
    case 'aging':
      return `Refresh due in ${remainingDays}d — ${window.cadence} window${cite}.`;
    case 'stale':
      return `Stale — past the ${window.windowDays}-day ${window.label.toLowerCase()} window${cite}; acceptance pauses for this evidence until it is refreshed.`;
    case 'expired':
      return `Expired — beyond 1.5× the ${window.windowDays}-day window${cite}; must be re-checked before it can be reused.`;
    case 'unknown':
    default:
      return `Not yet checked — ${window.label.toLowerCase()} has no observation.`;
  }
}

/**
 * Evaluate an evidence item's freshness against its regulatory window.
 * `now` is injected (ISO) so callers control the clock; never reads Date.now().
 */
export function evaluateRegulatoryFreshness(input: {
  checkedAt: string | null;
  window: RegulatoryWindow;
  now: string;
}): RegulatoryFreshness {
  const { checkedAt, window, now } = input;

  if (!checkedAt) {
    return {
      tone: 'unknown',
      ageDays: null,
      remainingDays: null,
      nextDueAt: null,
      escalation: 'none',
      consequence: buildConsequence('unknown', null, null, window),
      windowDays: window.windowDays,
      code: window.code,
    };
  }

  const nowMs = new Date(now).getTime();
  const checkedMs = new Date(checkedAt).getTime();
  const ageDays = Math.max(0, wholeDaysBetween(nowMs, checkedMs));
  const remainingDays = window.windowDays - ageDays;
  const nextDueAt = isoDate(checkedMs + window.windowDays * DAY_MS);

  let tone: FreshnessTone;
  if (remainingDays > 0) {
    tone = remainingDays / window.windowDays < 0.5 ? 'aging' : 'current';
  } else if (ageDays >= window.windowDays * 1.5) {
    tone = 'expired';
  } else {
    tone = 'stale';
  }

  // Window-relative escalation (the literal 90/60/30-day ladder is applied to
  // credential *expiry* in ExpiryHorizon; a fixed 30-day cutoff misfires on a
  // 30-day monitoring window, so cadence escalation scales with the window).
  const ratio = remainingDays / window.windowDays;
  let escalation: FreshnessEscalation = 'none';
  if (remainingDays <= 0 || ratio <= 0.1) escalation = 'urgent';
  else if (ratio <= 0.25) escalation = 'warning';
  else if (ratio <= 0.5) escalation = 'notice';

  return {
    tone,
    ageDays,
    remainingDays,
    nextDueAt,
    escalation,
    consequence: buildConsequence(tone, remainingDays, nextDueAt, window),
    windowDays: window.windowDays,
    code: window.code,
  };
}

/** Map a freshness tone to a Calm Wave `--vt-state-*` token family. */
export function freshnessToneToken(tone: FreshnessTone): string {
  switch (tone) {
    case 'current':
      return 'var(--vt-state-source-confirmed)';
    case 'aging':
      return 'var(--vt-state-pending)';
    case 'stale':
    case 'expired':
      return 'var(--vt-state-blocked)';
    case 'unknown':
    default:
      return 'var(--vt-state-unknown)';
  }
}
