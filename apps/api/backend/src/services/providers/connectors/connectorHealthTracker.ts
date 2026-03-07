/**
 * connectorHealthTracker.ts — Wave 127: Connector Health Tracking
 *
 * Tracks success/failure state for each provider connector.
 * Consumed by smoke tests, system status, and mission ops.
 */

import { log } from '../../../obs/logger';
import type { ConnectorName, ConnectorMode } from './connectorFactory';
import { getConnectorMode } from './connectorFactory';

export interface ConnectorHealthEntry {
  connector: ConnectorName;
  mode: ConnectorMode;
  status: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE';
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  successCount: number;
  errorCount: number;
  consecutiveErrors: number;
}

export interface ConnectorHealthReport {
  connectors: ConnectorHealthEntry[];
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  reportedAt: string;
}

// ── In-Memory Tracking ──────────────────────────────────────────────

interface TrackerState {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  successCount: number;
  errorCount: number;
  consecutiveErrors: number;
}

const ALL_CONNECTORS: ConnectorName[] = ['STATE_BOARD', 'OIG', 'ABMS', 'CAQH', 'NPDB'];
const trackers = new Map<ConnectorName, TrackerState>();

function getTracker(connector: ConnectorName): TrackerState {
  if (!trackers.has(connector)) {
    trackers.set(connector, {
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      successCount: 0,
      errorCount: 0,
      consecutiveErrors: 0,
    });
  }
  return trackers.get(connector)!;
}

// ── Public API ──────────────────────────────────────────────────────

export function recordConnectorSuccess(connector: ConnectorName): void {
  const t = getTracker(connector);
  t.lastSuccessAt = new Date().toISOString();
  t.successCount++;
  t.consecutiveErrors = 0;
  log('debug', `connector_health: ${connector} success`, { total: t.successCount });
}

export function recordConnectorFailure(connector: ConnectorName, error: string): void {
  const t = getTracker(connector);
  t.lastErrorAt = new Date().toISOString();
  t.lastError = error;
  t.errorCount++;
  t.consecutiveErrors++;
  log('warn', `connector_health: ${connector} failure`, { error, consecutive: t.consecutiveErrors });
}

function entryStatus(t: TrackerState): ConnectorHealthEntry['status'] {
  if (t.consecutiveErrors >= 5) return 'UNREACHABLE';
  if (t.consecutiveErrors >= 2) return 'DEGRADED';
  return 'HEALTHY';
}

export function getConnectorHealth(): ConnectorHealthReport {
  const connectors: ConnectorHealthEntry[] = ALL_CONNECTORS.map((name) => {
    const t = getTracker(name);
    return {
      connector: name,
      mode: getConnectorMode(name),
      status: entryStatus(t),
      lastSuccessAt: t.lastSuccessAt,
      lastErrorAt: t.lastErrorAt,
      lastError: t.lastError,
      successCount: t.successCount,
      errorCount: t.errorCount,
      consecutiveErrors: t.consecutiveErrors,
    };
  });

  const unreachable = connectors.filter((c) => c.status === 'UNREACHABLE').length;
  const degraded = connectors.filter((c) => c.status === 'DEGRADED').length;
  const overall: ConnectorHealthReport['overall'] =
    unreachable >= 3 ? 'CRITICAL'
    : unreachable >= 1 || degraded >= 2 ? 'DEGRADED'
    : 'HEALTHY';

  return {
    connectors,
    overall,
    reportedAt: new Date().toISOString(),
  };
}

export function resetConnectorHealth(): void {
  trackers.clear();
}
