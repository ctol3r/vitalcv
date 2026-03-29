import {
  coverageSatisfiesDecisionGradeTruth,
  resolveCanonicalSourceCoverageState,
  type CanonicalSourceCoverageState,
} from '../../../../../../packages/trust-state/sourceCoverage';
import { getIntegrationHealth } from '../externalIntegrations/integrationHealthTracker';
import {
  isImplementedIngestSource,
  isSourceFlagEnabled,
  LAUNCH_SPINE_SOURCE_IDS,
  listSources,
  type SourceDefinition,
} from '../identity/sourceCatalog';
import { SOURCE_GOVERNANCE } from '../identity/sourceGovernance';
import {
  getConnectorHealth,
  type ConnectorHealthEntry,
} from '../providers/connectors/connectorHealthTracker';

export interface SourceOpsReport {
  timestamp: string;
  sources: SourceOpsEntry[];
  spineStatus: 'HEALTHY' | 'DEGRADED' | 'STALE' | 'CRITICAL';
  alerts: string[];
}

export interface SourceOpsEntry {
  sourceId: string;
  name: string;
  isSpine: boolean;
  supportedInLaunchLane: boolean;
  decisionGrade: boolean;
  liveDecisionGrade: boolean;
  coverageState: CanonicalSourceCoverageState;
  featureFlag: {
    key: string;
    enabled: boolean;
    mismatch: boolean;
  };
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  freshnessSlaHours: number;
}

export const OFFICIAL_SPINE_SOURCES = LAUNCH_SPINE_SOURCE_IDS;

function readSourceEnabled(source: SourceDefinition): boolean {
  return isSourceFlagEnabled(source);
}

function findConnectorEntry(
  source: SourceDefinition,
  connectors: ConnectorHealthEntry[],
): ConnectorHealthEntry | undefined {
  return connectors.find((entry) => source.id.startsWith(entry.connector));
}

function readSourceHealth(
  source: SourceDefinition,
  connectorEntry: ConnectorHealthEntry | undefined,
  integrationHealth: ReturnType<typeof getIntegrationHealth>,
): Pick<SourceOpsEntry, 'lastSuccessAt' | 'lastFailureAt' | 'consecutiveFailures'> {
  if (connectorEntry) {
    return {
      lastSuccessAt: connectorEntry.lastSuccessAt,
      lastFailureAt: connectorEntry.lastErrorAt,
      consecutiveFailures: connectorEntry.consecutiveErrors,
    };
  }

  if (source.id === 'NURSYS') {
    return {
      lastSuccessAt: integrationHealth.lastNursysFetch,
      lastFailureAt: null,
      consecutiveFailures: 0,
    };
  }

  if (source.id === 'PECOS_PUBLIC') {
    return {
      lastSuccessAt: integrationHealth.lastPecosCheck,
      lastFailureAt: null,
      consecutiveFailures: 0,
    };
  }

  return {
    lastSuccessAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
  };
}

function isFresh(lastSuccessAt: string | null, freshnessSlaHours: number): boolean {
  if (!lastSuccessAt) {
    return false;
  }

  const ageMs = Date.now() - new Date(lastSuccessAt).getTime();
  return ageMs <= freshnessSlaHours * 3_600_000;
}

function nextSpineStatus(
  current: SourceOpsReport['spineStatus'],
  next: SourceOpsReport['spineStatus'],
): SourceOpsReport['spineStatus'] {
  const order: Record<SourceOpsReport['spineStatus'], number> = {
    HEALTHY: 0,
    DEGRADED: 1,
    STALE: 2,
    CRITICAL: 3,
  };

  return order[next] > order[current] ? next : current;
}

function resolveSourceOpsCoverageState(input: {
  sourceImplemented: boolean;
  sourceEnabled: boolean;
  sourceDecisionGrade: boolean;
  hasSuccessfulFetch: boolean;
  fresh: boolean;
  connectorStatus: ConnectorHealthEntry['status'] | null;
  governanceAccessBoundary: string | null;
}): CanonicalSourceCoverageState {
  if (!input.sourceImplemented) {
    return input.sourceEnabled ? 'notDecisionGrade' : 'pending';
  }

  if (!input.sourceEnabled) {
    return 'pending';
  }

  return resolveCanonicalSourceCoverageState({
    checked: input.hasSuccessfulFetch,
    fresh: input.fresh,
    unavailable: input.connectorStatus === 'UNREACHABLE',
    gated:
      input.governanceAccessBoundary === 'institutional'
      || input.governanceAccessBoundary === 'gated',
    notDecisionGrade: !input.sourceDecisionGrade,
  });
}

export function computeSourceOpsReport(): SourceOpsReport {
  const catalog = listSources();
  const connectorHealth = getConnectorHealth();
  const integrationHealth = getIntegrationHealth();

  const sources: SourceOpsEntry[] = [];
  const alerts: string[] = [];
  let spineStatus: SourceOpsReport['spineStatus'] = 'HEALTHY';

  for (const source of catalog) {
    const isSpine = OFFICIAL_SPINE_SOURCES.includes(source.id as (typeof OFFICIAL_SPINE_SOURCES)[number]);
    const sourceImplemented = isImplementedIngestSource(source.id);
    const connectorEntry = findConnectorEntry(source, connectorHealth.connectors);
    const sourceHealth = readSourceHealth(source, connectorEntry, integrationHealth);
    const sourceEnabled = readSourceEnabled(source);
    const fresh = sourceImplemented && isFresh(sourceHealth.lastSuccessAt, source.refreshSlaHours);
    const governance = SOURCE_GOVERNANCE[source.id];
    const coverageState = resolveSourceOpsCoverageState({
      sourceImplemented,
      sourceEnabled,
      sourceDecisionGrade: source.decisionGrade,
      hasSuccessfulFetch: Boolean(sourceHealth.lastSuccessAt),
      fresh,
      connectorStatus: connectorEntry?.status ?? null,
      governanceAccessBoundary: governance?.accessBoundary ?? null,
    });

    const decisionGrade = source.decisionGrade && sourceImplemented;
    const liveDecisionGrade = decisionGrade && coverageSatisfiesDecisionGradeTruth({ state: coverageState });
    const featureFlagMismatch = isSpine && !sourceEnabled;
    const isUnavailable = coverageState === 'unavailable';
    const isStale = coverageState === 'stale';

    if (isSpine) {
      if (isUnavailable) {
        spineStatus = nextSpineStatus(spineStatus, 'CRITICAL');
      } else if (isStale) {
        spineStatus = nextSpineStatus(spineStatus, 'STALE');
      } else if (featureFlagMismatch) {
        spineStatus = nextSpineStatus(spineStatus, 'DEGRADED');
      } else if (sourceHealth.consecutiveFailures >= 3) {
        spineStatus = nextSpineStatus(spineStatus, 'DEGRADED');
      }
    }

    if (
      sourceEnabled
      && sourceImplemented
      && (source.tier === 'GOLD' || source.tier === 'SILVER')
      && sourceHealth.lastSuccessAt
      && !fresh
      && !isUnavailable
    ) {
      alerts.push(
        `STALE: Decision-grade source ${source.name} has missed its freshness SLA of ${source.refreshSlaHours}h.`,
      );
    }

    if (sourceHealth.consecutiveFailures >= 3) {
      alerts.push(`FAILURE: Source ${source.name} has failed ${sourceHealth.consecutiveFailures} consecutive times.`);
    }

    if (!sourceEnabled && isSpine) {
      alerts.push(`MISMATCH: Official spine source ${source.name} has feature flag ${source.envFlag} disabled.`);
    }

    if (sourceEnabled && !sourceImplemented) {
      alerts.push(
        `UNIMPLEMENTED: Source ${source.name} is flag-enabled but has no ingestion handler in the launch lane.`,
      );
    }

    sources.push({
      sourceId: source.id,
      name: source.name,
      isSpine,
      supportedInLaunchLane: sourceImplemented,
      decisionGrade,
      liveDecisionGrade,
      coverageState,
      featureFlag: {
        key: source.envFlag,
        enabled: sourceEnabled,
        mismatch: featureFlagMismatch,
      },
      lastSuccessAt: sourceHealth.lastSuccessAt,
      lastFailureAt: sourceHealth.lastFailureAt,
      consecutiveFailures: sourceHealth.consecutiveFailures,
      freshnessSlaHours: source.refreshSlaHours,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    sources,
    spineStatus,
    alerts,
  };
}
