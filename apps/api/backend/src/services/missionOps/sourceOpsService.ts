import {
  buildSourceHealthFreshness,
  createCanonicalSourceCoverage,
  isSourceHealthFresh,
  resolveCanonicalSourceCoverageState,
  summarizeCanonicalSourceCoverage,
  type CanonicalSourceCoverageState,
  type SourceHealthEntry as SourceOpsEntry,
  type SourceHealthOperatorStatus,
  type SourceHealthReport as SourceOpsReport,
} from '../../../../../../packages/trust-state';
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

export type { SourceOpsEntry, SourceOpsReport };

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

function describeCoverageState(input: {
  source: SourceDefinition;
  coverageState: CanonicalSourceCoverageState;
  sourceImplemented: boolean;
  sourceEnabled: boolean;
  connectorEntry: ConnectorHealthEntry | undefined;
  sourceHealth: Pick<SourceOpsEntry, 'lastSuccessAt' | 'lastFailureAt' | 'consecutiveFailures'>;
}): string {
  const {
    source,
    coverageState,
    sourceImplemented,
    sourceEnabled,
    connectorEntry,
    sourceHealth,
  } = input;

  if (!sourceImplemented && sourceEnabled) {
    return `${source.name} is flag-enabled but has no ingestion handler in the launch lane.`;
  }

  if (!sourceEnabled) {
    return `${source.name} is disabled by feature flag ${source.envFlag}.`;
  }

  if (source.id === 'PECOS_PUBLIC' && coverageState === 'previewOnly') {
    return `${source.name} is running in preview-only mode and must not be treated as decision-grade enrollment truth.`;
  }

  switch (coverageState) {
    case 'checked':
      return `${source.name} is inside its ${source.refreshSlaHours}h freshness window.`;
    case 'stale':
      return `${source.name} has missed its freshness SLA of ${source.refreshSlaHours}h.`;
    case 'unavailable':
      return connectorEntry?.status === 'UNREACHABLE'
        ? `${source.name} connector is unreachable.`
        : `${source.name} has not produced a supported launch-lane result.`;
    case 'gated':
      return `${source.name} requires institutional access before it can produce decision-grade coverage.`;
    case 'accessRequired':
      return `${source.name} requires an access-controlled lookup before it can produce coverage.`;
    case 'reviewRequired':
      return `${source.name} produced a result that requires operator review.`;
    case 'notDecisionGrade':
      return `${source.name} is outside the decision-grade launch lane.`;
    case 'previewOnly':
      return `${source.name} is preview-only and excluded from monitoring decisions.`;
    case 'pending':
      return sourceHealth.lastSuccessAt
        ? `${source.name} has historical activity but is not active in this environment.`
        : `${source.name} has not produced a successful fetch yet.`;
  }
}

function readOperatorStatus(input: {
  coverageState: CanonicalSourceCoverageState;
  consecutiveFailures: number;
}): SourceHealthOperatorStatus {
  if (input.coverageState === 'unavailable') {
    return 'CRITICAL';
  }

  if (input.coverageState === 'stale') {
    return 'STALE';
  }

  if (input.consecutiveFailures >= 3) {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

export function computeSourceOpsReport(): SourceOpsReport {
  const catalog = listSources();
  const connectorHealth = getConnectorHealth();
  const integrationHealth = getIntegrationHealth();
  const now = new Date();

  const sources: SourceOpsEntry[] = [];
  const alerts: string[] = [];
  const launchSpineCoverageChecks: ReturnType<typeof createCanonicalSourceCoverage>[] = [];
  let spineStatus: SourceOpsReport['spineStatus'] = 'HEALTHY';

  for (const source of catalog) {
    const isSpine = OFFICIAL_SPINE_SOURCES.includes(
      source.id as (typeof OFFICIAL_SPINE_SOURCES)[number],
    );
    const sourceImplemented = isImplementedIngestSource(source.id);
    const connectorEntry = findConnectorEntry(source, connectorHealth.connectors);
    const sourceHealth = readSourceHealth(source, connectorEntry, integrationHealth);
    const sourceEnabled = readSourceEnabled(source);
    const previewOnly =
      source.id === 'PECOS_PUBLIC'
      && integrationHealth.pecosMode === 'mock';
    const fresh = sourceImplemented && isSourceHealthFresh({
      lastSuccessAt: sourceHealth.lastSuccessAt,
      freshnessWindowHours: source.refreshSlaHours,
      now,
    });
    const governance = SOURCE_GOVERNANCE[source.id];
    const coverageState = !sourceImplemented
      ? sourceEnabled
        ? 'unavailable'
        : 'pending'
      : !sourceEnabled
        ? 'pending'
        : resolveCanonicalSourceCoverageState({
            previewOnly,
            checked: Boolean(sourceHealth.lastSuccessAt),
            fresh,
            unavailable: connectorEntry?.status === 'UNREACHABLE',
            gated:
              governance?.accessBoundary === 'institutional'
              || governance?.accessBoundary === 'gated',
            notDecisionGrade: !source.decisionGrade,
          });
    const coverageReason = describeCoverageState({
      source,
      coverageState,
      sourceImplemented,
      sourceEnabled,
      connectorEntry,
      sourceHealth,
    });
    const operatorStatus = readOperatorStatus({
      coverageState,
      consecutiveFailures: sourceHealth.consecutiveFailures,
    });
    const coverage = createCanonicalSourceCoverage({
      sourceId: source.id,
      state: coverageState,
      reason: coverageReason,
      checkedAt: sourceHealth.lastSuccessAt,
      freshnessWindowHours: source.refreshSlaHours,
    });

    const decisionGrade = coverageState === 'checked';
    const isUnavailable = coverageState === 'unavailable';
    const isStale = coverageState === 'stale';

    if (isSpine) {
      if (isUnavailable) {
        spineStatus = nextSpineStatus(spineStatus, 'CRITICAL');
      } else if (isStale) {
        spineStatus = nextSpineStatus(spineStatus, 'STALE');
      } else if (sourceHealth.consecutiveFailures >= 3) {
        spineStatus = nextSpineStatus(spineStatus, 'DEGRADED');
      }
      launchSpineCoverageChecks.push(coverage);
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
      alerts.push(
        `FAILURE: Source ${source.name} has failed ${sourceHealth.consecutiveFailures} consecutive times.`,
      );
    }

    if (!sourceEnabled && isSpine) {
      alerts.push(
        `MISMATCH: Official spine source ${source.name} has feature flag ${source.envFlag} disabled.`,
      );
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
      supported: sourceImplemented,
      decisionGrade,
      coverageState,
      coverageReason,
      operatorStatus,
      featureFlag: {
        key: source.envFlag,
        enabled: sourceEnabled,
      },
      lastSuccessAt: sourceHealth.lastSuccessAt,
      lastFailureAt: sourceHealth.lastFailureAt,
      consecutiveFailures: sourceHealth.consecutiveFailures,
      freshnessSlaHours: source.refreshSlaHours,
      freshness: buildSourceHealthFreshness({
        coverageState,
        lastSuccessAt: sourceHealth.lastSuccessAt,
        freshnessWindowHours: source.refreshSlaHours,
        now,
      }),
    });
  }

  return {
    timestamp: now.toISOString(),
    sources,
    sourceCoverage: {
      checks: launchSpineCoverageChecks,
      summary: summarizeCanonicalSourceCoverage(launchSpineCoverageChecks),
    },
    spineStatus,
    alerts,
  };
}
