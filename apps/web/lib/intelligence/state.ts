import type { IntelligenceSystemHealth } from './contracts';
import { formatRelativeTime } from './time';

export const DEFAULT_STALE_DATA_THRESHOLD_MS = 15 * 60 * 1000;

export interface SurfaceFreshnessState {
  ageMinutes: number | null;
  isStale: boolean;
  timestamp: string | null;
}

export interface FindingsEmptyState {
  description: string;
  title: string;
}

function parseTimestamp(input: string | null | undefined): number | null {
  if (!input) {
    return null;
  }

  const timestamp = Date.parse(input);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getSurfaceFreshnessState(input: {
  generatedAt?: string | null;
  lastUpdated?: string | null;
  now?: number;
  thresholdMs?: number;
}): SurfaceFreshnessState {
  const thresholdMs = input.thresholdMs ?? DEFAULT_STALE_DATA_THRESHOLD_MS;
  const timestamp = parseTimestamp(input.generatedAt) ?? parseTimestamp(input.lastUpdated);

  if (timestamp === null) {
    return {
      ageMinutes: null,
      isStale: false,
      timestamp: null,
    };
  }

  const ageMs = Math.max(0, (input.now ?? Date.now()) - timestamp);
  return {
    ageMinutes: Math.max(1, Math.round(ageMs / 60_000)),
    isStale: ageMs >= thresholdMs,
    timestamp: new Date(timestamp).toISOString(),
  };
}

export function formatLastRefreshMessage(ageMinutes: number): string {
  const now = Date.now();
  const refreshedAt = now - (Math.max(0, ageMinutes) * 60_000);
  return `Data last refreshed ${formatRelativeTime(new Date(refreshedAt), now)}.`;
}

export function hasDegradedDataSources(
  health: Pick<IntelligenceSystemHealth, 'cards'> | null | undefined,
): boolean {
  if (!health) {
    return false;
  }

  return health.cards.some((card) => (
    card.id === 'connectivity' &&
    (card.tone === 'degraded' || card.tone === 'critical')
  ));
}

export function getFindingsEmptyState(input: {
  findingCount: number;
  hasFilters: boolean;
  providerCount?: number | null;
}): FindingsEmptyState | null {
  if (input.findingCount > 0) {
    return null;
  }

  if (input.hasFilters) {
    return {
      title: 'No findings match your filters.',
      description: 'Adjust or clear the filters to widen the result set.',
    };
  }

  if (input.providerCount === 0) {
    return {
      title: 'Add providers to begin monitoring.',
      description: 'No providers are connected yet, so the findings feed has nothing to evaluate.',
    };
  }

  return {
    title: 'No findings generated yet.',
    description: 'Investigators have not generated any findings in the current environment yet.',
  };
}
