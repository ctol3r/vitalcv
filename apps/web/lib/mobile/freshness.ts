export interface MobileFreshnessState {
  ageMinutes: number | null;
  ageMs: number | null;
  isAging: boolean;
  isStale: boolean;
  label: string;
  detail: string;
  absoluteLabel: string | null;
}

const AGING_THRESHOLD_MINUTES = 30;
const STALE_THRESHOLD_MINUTES = 180;

export function buildMobileFreshnessState(
  refreshedAt: string | null | undefined,
  now = Date.now(),
): MobileFreshnessState {
  if (!refreshedAt) {
    return {
      ageMinutes: null,
      ageMs: null,
      isAging: true,
      isStale: true,
      label: 'Freshness unknown',
      detail: 'Refresh recommended before relying on this workspace state.',
      absoluteLabel: null,
    };
  }

  const parsed = Date.parse(refreshedAt);
  if (Number.isNaN(parsed)) {
    return {
      ageMinutes: null,
      ageMs: null,
      isAging: true,
      isStale: true,
      label: 'Freshness unknown',
      detail: 'Refresh recommended before relying on this workspace state.',
      absoluteLabel: null,
    };
  }

  const ageMs = Math.max(0, now - parsed);
  const ageMinutes = Math.floor(ageMs / 60_000);
  const absoluteLabel = new Date(parsed).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (ageMinutes < 1) {
    return {
      ageMinutes,
      ageMs,
      isAging: false,
      isStale: false,
      label: 'Synced just now',
      detail: `Last synced ${absoluteLabel}.`,
      absoluteLabel,
    };
  }

  if (ageMinutes < AGING_THRESHOLD_MINUTES) {
    return {
      ageMinutes,
      ageMs,
      isAging: false,
      isStale: false,
      label: `Synced ${ageMinutes} min ago`,
      detail: `Last synced ${absoluteLabel}.`,
      absoluteLabel,
    };
  }

  if (ageMinutes < STALE_THRESHOLD_MINUTES) {
    const hours = Math.floor(ageMinutes / 60);
    const minutes = ageMinutes % 60;
    const ageLabel = hours > 0
      ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
      : `${ageMinutes} min`;

    return {
      ageMinutes,
      ageMs,
      isAging: true,
      isStale: false,
      label: `Sync aging · ${ageLabel}`,
      detail: `Last synced ${absoluteLabel}. Refresh if you need the latest application or readiness state.`,
      absoluteLabel,
    };
  }

  const hours = Math.floor(ageMinutes / 60);
  return {
    ageMinutes,
    ageMs,
    isAging: true,
    isStale: true,
    label: `Refresh recommended · ${hours}h old`,
    detail: `Last synced ${absoluteLabel}. Pull a fresh state before relying on updates, matches, or readiness.`,
    absoluteLabel,
  };
}
