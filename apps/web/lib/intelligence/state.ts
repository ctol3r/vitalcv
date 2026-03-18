import type {
  IntelligenceAccessMode,
  IntelligenceAccessReason,
  IntelligenceSystemHealth,
} from './contracts';
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

export interface AccessBannerState {
  tone: 'info' | 'warning' | 'neutral';
  description: string;
}

export interface AccessEmptyState {
  title: string;
  description: string;
}

export type SystemHealthSurfaceMode = 'healthy' | 'empty' | 'degraded' | 'broken';

export interface SystemHealthSurfaceState {
  mode: SystemHealthSurfaceMode;
  label: string;
  description: string;
}

export function getAccessBannerState(
  accessMode: IntelligenceAccessMode | null | undefined,
  reason: IntelligenceAccessReason | null | undefined,
): AccessBannerState | null {
  // Intelligence is fully public — only show banners for genuine backend issues.
  if (!accessMode || !reason || reason === 'ok' || reason === 'missing_session' || reason === 'missing_org') {
    return null;
  }

  switch (reason) {
    case 'warming_up':
      return {
        tone: 'info',
        description: 'System warming up — ingesting provider intelligence. Live findings will appear shortly.',
      };
    case 'backend_unavailable':
      return {
        tone: 'warning',
        description: 'Live intelligence is temporarily unavailable. Retry once backend services recover.',
      };
    case 'ok':
    default:
      return null;
  }
}

export function getAccessEmptyState(input: {
  error: string | null | undefined;
  resourceLabel: string;
}): AccessEmptyState | null {
  const description = input.error?.trim();
  if (!description) {
    return null;
  }

  const normalized = description.toLowerCase();

  if (
    normalized.includes('organization workspace required')
    || normalized.includes('organization context is required')
  ) {
    return {
      title: `Switch workspace to load ${input.resourceLabel}`,
      description,
    };
  }

  if (
    normalized.includes('sign in')
    || normalized.includes('authentication required')
  ) {
    return {
      title: `Sign in to load ${input.resourceLabel}`,
      description,
    };
  }

  return null;
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

function parseLeadingInt(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d+)/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1] ?? '', 10);
}

export function deriveSystemHealthSurfaceState(
  health: IntelligenceSystemHealth | null | undefined,
  hasHardError = false,
): SystemHealthSurfaceState {
  if (hasHardError || !health) {
    return {
      mode: 'broken',
      label: 'Broken',
      description: 'Core trust telemetry is unavailable. Operators should treat downstream evidence as incomplete until health recovers.',
    };
  }

  const criticalCards = health.cards.filter((card) => card.tone === 'critical').length;
  const degradedCards = health.cards.filter((card) => card.tone === 'degraded').length;
  const outageSources = health.sources.filter((source) => source.status === 'OUTAGE').length;
  const nonOperationalSources = health.sources.filter((source) => source.status !== 'OPERATIONAL').length;
  const verificationCard = health.cards.find((card) => card.id === 'verification');
  const lastHourVerifications = parseLeadingInt(verificationCard?.summary) ?? 0;
  const hasArtifactTraffic = health.sources.some((source) => source.artifactCount > 0);
  const hasOperatorSignals = health.incidents.length > 0 || lastHourVerifications > 0 || hasArtifactTraffic;
  const hasSourceCoverage = health.sources.length > 0;

  if (
    health.overall === 'critical'
    && (criticalCards >= 2 || (hasSourceCoverage && outageSources === health.sources.length))
  ) {
    return {
      mode: 'broken',
      label: 'Broken',
      description: 'Multiple trust subsystems are failing closed. Evidence freshness and source coverage should be considered unreliable until remediation completes.',
    };
  }

  if (!hasOperatorSignals && criticalCards === 0 && degradedCards === 0) {
    return {
      mode: 'empty',
      label: 'Empty but functioning',
      description: hasSourceCoverage
        ? 'Health checks are responding, but no recent verification traffic or source artifacts have been observed yet.'
        : 'The health plane is reachable, but no sources have reported telemetry yet.',
    };
  }

  if (criticalCards > 0 || degradedCards > 0 || nonOperationalSources > 0 || health.incidents.length > 0) {
    return {
      mode: 'degraded',
      label: 'Degraded',
      description: 'The trust plane is still serving data, but one or more connectors, integrity checks, or incidents require operator attention.',
    };
  }

  return {
    mode: 'healthy',
    label: 'Healthy',
    description: 'Connectors, verification throughput, and graph integrity are operating normally with live telemetry.',
  };
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
