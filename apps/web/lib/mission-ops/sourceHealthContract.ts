import {
  sourceCoverageStateLabel,
  type PassportSourceCoverageState,
} from '@/lib/trust/source-coverage';
import type { SourceOpsEntry } from '@/lib/mission-ops/sourceOpsTypes';

export const PILOT_SOURCE_IDS = ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC'] as const;

export type SourceHealthErrorClass =
  | 'connectivity'
  | 'freshness'
  | 'config'
  | 'unsupported'
  | 'review';

export interface SourceHealthErrorGroup {
  label: string;
  className: SourceHealthErrorClass;
  sources: SourceOpsEntry[];
}

function dedupeSources(sources: SourceOpsEntry[]): SourceOpsEntry[] {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (seen.has(source.sourceId)) {
      return false;
    }

    seen.add(source.sourceId);
    return true;
  });
}

export function formatSourceHealthAge(isoDate: string | null): string {
  if (!isoDate) return 'never';
  const ms = Date.now() - new Date(isoDate).getTime();
  if (ms < 0) return 'just now';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) {
    const mins = Math.floor(ms / 60_000);
    return mins < 1 ? 'just now' : `${mins}m ago`;
  }
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatSourceHealthCoverageState(
  state: PassportSourceCoverageState,
): string {
  return sourceCoverageStateLabel(state);
}

export function filterPilotSources(sources: SourceOpsEntry[]): SourceOpsEntry[] {
  return sources.filter(
    (source) => PILOT_SOURCE_IDS.includes(source.sourceId as (typeof PILOT_SOURCE_IDS)[number]) || source.isSpine,
  );
}

export function classifySourceHealthErrors(
  spineSources: SourceOpsEntry[],
): SourceHealthErrorGroup[] {
  const groups: SourceHealthErrorGroup[] = [];

  const connectivity = dedupeSources(
    spineSources.filter((source) => source.coverageState === 'unavailable'),
  );
  if (connectivity.length > 0) {
    groups.push({ label: 'Connectivity', className: 'connectivity', sources: connectivity });
  }

  const freshness = dedupeSources(
    spineSources.filter((source) => source.coverageState === 'stale'),
  );
  if (freshness.length > 0) {
    groups.push({ label: 'Freshness', className: 'freshness', sources: freshness });
  }

  const config = dedupeSources(
    spineSources.filter((source) => (
      source.featureFlag.mismatch
      || source.coverageState === 'pending'
      || source.coverageState === 'gated'
      || source.coverageState === 'accessRequired'
    )),
  );
  if (config.length > 0) {
    groups.push({ label: 'Configuration', className: 'config', sources: config });
  }

  const unsupported = dedupeSources(
    spineSources.filter((source) => (
      !source.supportedInLaunchLane
      || source.coverageState === 'notDecisionGrade'
      || source.coverageState === 'previewOnly'
    )),
  );
  if (unsupported.length > 0) {
    groups.push({ label: 'Unsupported', className: 'unsupported', sources: unsupported });
  }

  const review = dedupeSources(
    spineSources.filter((source) => source.coverageState === 'reviewRequired'),
  );
  if (review.length > 0) {
    groups.push({ label: 'Manual review', className: 'review', sources: review });
  }

  return groups;
}
