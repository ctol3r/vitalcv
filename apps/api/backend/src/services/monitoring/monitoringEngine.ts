/**
 * monitoringEngine.ts — Wave 85: Credential Monitoring Engine
 *
 * Runs continuous monitoring checks: license expiration, DEA expiration,
 * board certification, OIG exclusion updates.
 */

import { scanExpirations, type ExpirationAlert } from './expirationScanner';
import { detectRevocationSignals, type RevocationSignal } from './revocationListener';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export interface MonitoringReport {
  timestamp: string;
  expirationAlerts: ExpirationAlert[];
  revocationSignals: RevocationSignal[];
  summary: {
    totalExpiring: number;
    totalRevoked: number;
    criticalCount: number;
  };
}

// ── Core Monitoring ───────────────────────────────────────────────────

export async function runCredentialMonitoring(): Promise<MonitoringReport> {
  const [expirationAlerts, revocationSignals] = await Promise.all([
    scanExpirations(),
    detectRevocationSignals(),
  ]);

  const criticalCount =
    expirationAlerts.filter((a) => a.severity === 'EXPIRED' || a.severity === 'CRITICAL').length +
    revocationSignals.length;

  const report: MonitoringReport = {
    timestamp: new Date().toISOString(),
    expirationAlerts,
    revocationSignals,
    summary: {
      totalExpiring: expirationAlerts.length,
      totalRevoked: revocationSignals.length,
      criticalCount,
    },
  };

  log('info', 'monitoring_engine: run complete', report.summary);
  return report;
}
