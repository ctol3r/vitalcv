export type ActionScoringDomain = 'activation' | 'acceptance' | 'recognition';

export interface ActionScoringBlockerInput {
  domain: ActionScoringDomain;
  blockerId?: string | null;
  label: string;
  detail: string;
  actionTitle?: string | null;
  actionDetail?: string | null;
  effort_estimate?: number | null;
}

export interface DeterministicBestAction {
  domain: ActionScoringDomain;
  blockerId: string | null;
  blocker_label: string;
  title: string;
  detail: string;
  effort_estimate: number | null;
}

const DOMAIN_PRIORITY: Readonly<Record<ActionScoringDomain, number>> = {
  activation: 0,
  acceptance: 1,
  recognition: 2,
};

function asTrimmedString(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeEffortEstimate(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value);
}

function fallbackActionTitle(label: string): string {
  return `Resolve ${label}`;
}

function compareNullableNumbersAscending(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

export function scoreDeterministicBestAction(input: {
  blockers: readonly ActionScoringBlockerInput[];
}): DeterministicBestAction | null {
  const normalized = input.blockers
    .map((blocker) => {
      const label = asTrimmedString(blocker.label);
      const detail = asTrimmedString(blocker.detail);

      if (!label || !detail) {
        return null;
      }

      const actionTitle = asTrimmedString(blocker.actionTitle) ?? fallbackActionTitle(label);
      const actionDetail = asTrimmedString(blocker.actionDetail) ?? detail;
      const blockerId = asTrimmedString(blocker.blockerId);
      const effortEstimate = normalizeEffortEstimate(blocker.effort_estimate);

      return {
        domain: blocker.domain,
        blockerId,
        blockerLabel: label,
        title: actionTitle,
        detail: actionDetail,
        effortEstimate,
      };
    })
    .filter((blocker): blocker is NonNullable<typeof blocker> => blocker !== null);

  if (normalized.length === 0) {
    return null;
  }

  const best = [...normalized].sort((left, right) => {
    const byDomain = DOMAIN_PRIORITY[left.domain] - DOMAIN_PRIORITY[right.domain];
    if (byDomain !== 0) {
      return byDomain;
    }

    const byEffort = compareNullableNumbersAscending(left.effortEstimate, right.effortEstimate);
    if (byEffort !== 0) {
      return byEffort;
    }

    const byBlockerId = (left.blockerId ?? '').localeCompare(right.blockerId ?? '');
    if (byBlockerId !== 0) {
      return byBlockerId;
    }

    const byTitle = left.title.localeCompare(right.title);
    if (byTitle !== 0) {
      return byTitle;
    }

    const byLabel = left.blockerLabel.localeCompare(right.blockerLabel);
    if (byLabel !== 0) {
      return byLabel;
    }

    const byDetail = left.detail.localeCompare(right.detail);
    if (byDetail !== 0) {
      return byDetail;
    }

    return 0;
  })[0];

  return {
    domain: best.domain,
    blockerId: best.blockerId,
    blocker_label: best.blockerLabel,
    title: best.title,
    detail: best.detail,
    effort_estimate: best.effortEstimate,
  };
}
