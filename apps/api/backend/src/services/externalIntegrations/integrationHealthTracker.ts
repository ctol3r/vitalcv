/**
 * Integration Health Tracker — Wave X
 *
 * Tracks the last successful fetch timestamp for each integration
 * and provides a health status summary endpoint.
 *
 * Health is determined by:
 *   - Both integrations responding within the last 24 hours (when in live mode)
 *   - Mock mode is always considered healthy
 */

import type { IntegrationHealthStatus } from './types';
import { getNursysMode, getPecosMode } from './integrationFactory';

// ── In-memory timestamps ────────────────────────────────────

let _lastNursysFetch: Date | null = null;
let _lastPecosCheck: Date | null = null;

export function recordNursysFetch(): void {
  _lastNursysFetch = new Date();
}

export function recordPecosCheck(): void {
  _lastPecosCheck = new Date();
}

// ── Health evaluation ───────────────────────────────────────

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isRecentFetch(timestamp: Date | null, mode: string): boolean {
  if (mode === 'mock') return true;
  if (!timestamp) return false;
  return Date.now() - timestamp.getTime() < TWENTY_FOUR_HOURS_MS;
}

export function getIntegrationHealth(): IntegrationHealthStatus {
  const nursysMode = getNursysMode();
  const pecosMode = getPecosMode();

  const nursysHealthy = isRecentFetch(_lastNursysFetch, nursysMode);
  const pecosHealthy = isRecentFetch(_lastPecosCheck, pecosMode);

  return {
    nursysMode,
    pecosMode,
    lastNursysFetch: _lastNursysFetch?.toISOString() ?? null,
    lastPecosCheck: _lastPecosCheck?.toISOString() ?? null,
    healthy: nursysHealthy && pecosHealthy,
  };
}

// ── Reset (for testing) ─────────────────────────────────────

export function resetHealthTracker(): void {
  _lastNursysFetch = null;
  _lastPecosCheck = null;
}
