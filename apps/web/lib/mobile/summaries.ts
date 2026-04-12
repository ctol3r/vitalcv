import type {
  MobileApplication,
  MobileApplicationReadiness,
  MobileMatchBand,
  MobileOpportunityCard,
  MobileTrustBand,
  MobileTrustState,
} from '@/lib/mobile/dashboard';

export type MobileSummaryTone = 'emerald' | 'sky' | 'amber' | 'rose' | 'zinc';
export type MobileCompactBadgeKind = 'application' | 'match' | 'readiness';
export type MobileApplyEligibilityState = 'eligible' | 'blocked' | 'submitted';

export interface MobileMissingItemsSummary {
  items: string[];
  count: number;
  shortLabel: string;
  detail: string | null;
}

export interface MobileReadinessSummary {
  tone: MobileSummaryTone;
  badgeLabel: string;
  score: number | null;
  level: MobileTrustBand | null;
  status: string;
  shortStatus: string;
  missingItems: MobileMissingItemsSummary;
}

export interface MobileApplyEligibility {
  state: MobileApplyEligibilityState;
  canApply: boolean;
  badgeLabel: string;
  summary: string;
  blockers: string[];
}

export interface MobileSnapshotSummary {
  reused: boolean;
  badgeLabel: string;
  tone: MobileSummaryTone;
  summary: string;
  readiness: MobileReadinessSummary;
  missingItems: MobileMissingItemsSummary;
}

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Submitted',
  REVIEWED: 'In review',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
};

const APPLICATION_STATUS_TONES: Record<string, MobileSummaryTone> = {
  ACCEPTED: 'emerald',
  REVIEWED: 'sky',
  DECLINED: 'rose',
  WITHDRAWN: 'zinc',
  PENDING: 'amber',
};

const MATCH_BAND_LABELS: Record<MobileMatchBand, string> = {
  CLEAR: 'Clear',
  NEAR_CLEAR: 'Near clear',
  PARTIAL: 'Partial',
  INELIGIBLE: 'Blocked',
};

const READINESS_TONES: Record<MobileTrustBand, MobileSummaryTone> = {
  L3: 'emerald',
  L2: 'sky',
  L1: 'amber',
  L0: 'rose',
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function toTitleLabel(value: string): string {
  return normalizeText(value.replace(/_/g, ' ')).toLowerCase();
}

function uniqueItems(values: readonly string[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => normalizeText(value))
      .filter((value) => value.length > 0),
  ));
}

export function safeTruncateLabel(value: string, maxLength = 32): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 1) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function mobileApplicationStatusLabel(status: string): string {
  return APPLICATION_STATUS_LABELS[status] ?? toTitleLabel(status);
}

export function mobileApplicationStatusTone(status: string): MobileSummaryTone {
  return APPLICATION_STATUS_TONES[status] ?? 'amber';
}

export function buildCompactBadgeLabel(input:
  | { kind: 'application'; status: string; maxLength?: number }
  | { kind: 'match'; band: MobileMatchBand; maxLength?: number }
  | { kind: 'readiness'; level: MobileTrustBand; maxLength?: number }
): string {
  const maxLength = input.maxLength ?? 18;

  switch (input.kind) {
    case 'application':
      return safeTruncateLabel(mobileApplicationStatusLabel(input.status), maxLength);
    case 'match':
      return safeTruncateLabel(MATCH_BAND_LABELS[input.band], maxLength);
    case 'readiness':
      return safeTruncateLabel(input.level, maxLength);
    default:
      return 'Unknown';
  }
}

export function summarizeMissingMobileItems(
  items: readonly string[],
  options?: {
    emptyLabel?: string;
    maxLabelLength?: number;
  },
): MobileMissingItemsSummary {
  const normalized = uniqueItems(items);
  const maxLabelLength = options?.maxLabelLength ?? 36;

  if (normalized.length === 0) {
    return {
      items: [],
      count: 0,
      shortLabel: options?.emptyLabel ?? 'No missing items',
      detail: null,
    };
  }

  const first = normalized[0] ?? 'Missing item';
  const shortLabel = normalized.length === 1
    ? safeTruncateLabel(first, maxLabelLength)
    : `${safeTruncateLabel(first, maxLabelLength)} +${normalized.length - 1} more`;

  return {
    items: normalized,
    count: normalized.length,
    shortLabel,
    detail: normalized.length === 1
      ? first
      : `${first} plus ${normalized.length - 1} more item${normalized.length === 2 ? '' : 's'}`,
  };
}

function normalizeReadinessInput(
  input: MobileTrustState | MobileApplicationReadiness | null | undefined,
): {
  level: MobileTrustBand | null;
  score: number | null;
  status: string;
  gaps: string[];
} {
  if (!input) {
    return {
      level: null,
      score: null,
      status: 'Readiness unavailable',
      gaps: [],
    };
  }

  return {
    level: input.readinessLevel,
    score: input.readinessScore,
    status: input.readinessStatus,
    gaps: [...input.gapSummary],
  };
}

export function buildMobileReadinessSummary(
  input: MobileTrustState | MobileApplicationReadiness | null | undefined,
): MobileReadinessSummary {
  const normalized = normalizeReadinessInput(input);
  const tone = normalized.level ? READINESS_TONES[normalized.level] : 'zinc';
  const missingItems = summarizeMissingMobileItems(normalized.gaps, {
    emptyLabel: 'No gaps',
  });

  return {
    tone,
    badgeLabel: normalized.level
      ? buildCompactBadgeLabel({ kind: 'readiness', level: normalized.level })
      : 'No readiness',
    score: normalized.score,
    level: normalized.level,
    status: normalized.status,
    shortStatus: safeTruncateLabel(normalized.status, 56),
    missingItems,
  };
}

function blockerLabels(
  values: readonly string[] | readonly { label: string }[] | undefined,
): string[] {
  if (!values) {
    return [];
  }

  return uniqueItems(values.map((value) => typeof value === 'string' ? value : value.label));
}

export function evaluateMobileApplyEligibility(input: {
  application?: Pick<MobileApplication, 'status'> | null;
  opportunity?: Pick<MobileOpportunityCard, 'application' | 'match'> | null;
  matchBand?: MobileMatchBand | null;
  blockers?: readonly string[] | readonly { label: string }[];
}): MobileApplyEligibility {
  const application = input.application ?? input.opportunity?.application ?? null;
  if (application) {
    const label = mobileApplicationStatusLabel(application.status);
    return {
      state: 'submitted',
      canApply: false,
      badgeLabel: buildCompactBadgeLabel({ kind: 'application', status: application.status }),
      summary: `Application ${label.toLowerCase()}.`,
      blockers: [],
    };
  }

  const band = input.matchBand ?? input.opportunity?.match?.band ?? null;
  const blockers = blockerLabels(input.blockers ?? input.opportunity?.match?.blockers);
  const missing = summarizeMissingMobileItems(blockers, {
    emptyLabel: 'Missing details',
  });

  if (band === 'CLEAR') {
    return {
      state: 'eligible',
      canApply: true,
      badgeLabel: buildCompactBadgeLabel({ kind: 'match', band }),
      summary: 'Clear to apply now.',
      blockers,
    };
  }

  if (band === 'NEAR_CLEAR') {
    return {
      state: 'eligible',
      canApply: true,
      badgeLabel: buildCompactBadgeLabel({ kind: 'match', band }),
      summary: blockers.length > 0
        ? `Near clear. ${missing.shortLabel} still needs attention.`
        : 'Near clear to apply.',
      blockers,
    };
  }

  if (band === 'PARTIAL' || band === 'INELIGIBLE') {
    return {
      state: 'blocked',
      canApply: false,
      badgeLabel: band === 'PARTIAL' ? 'Partial' : 'Blocked',
      summary: blockers.length > 0
        ? `Apply is blocked by ${missing.shortLabel}.`
        : 'Apply is blocked until more requirements clear.',
      blockers,
    };
  }

  return {
    state: 'blocked',
    canApply: false,
    badgeLabel: 'Pending',
    summary: blockers.length > 0
      ? `Apply eligibility is waiting on ${missing.shortLabel}.`
      : 'Apply eligibility is not available yet.',
    blockers,
  };
}

export function buildMobileSnapshotSummary(input: {
  readiness?: MobileTrustState | MobileApplicationReadiness | null;
  missingItems?: readonly string[];
  reused?: boolean;
}): MobileSnapshotSummary {
  const readiness = buildMobileReadinessSummary(input.readiness);
  const missingItems = summarizeMissingMobileItems(
    input.missingItems?.length ? input.missingItems : readiness.missingItems.items,
    {
      emptyLabel: 'No missing items',
    },
  );

  return {
    reused: input.reused === true,
    badgeLabel: input.reused === true ? 'Snapshot reused' : 'Snapshot refreshed',
    tone: input.reused === true ? 'zinc' : readiness.tone,
    summary: input.reused === true
      ? 'Using the latest verified mobile snapshot.'
      : 'Captured a fresh mobile snapshot.',
    readiness,
    missingItems,
  };
}
