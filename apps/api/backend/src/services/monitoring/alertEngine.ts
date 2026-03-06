/**
 * alertEngine.ts — Wave 85: Alert Engine
 *
 * Aggregates expiration, revocation, and issuer trust degradation
 * alerts into a unified event stream.
 */

import { scanExpirations, type ExpirationAlert } from './expirationScanner';
import { detectRevocationSignals, type RevocationSignal } from './revocationListener';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type AlertType = 'license_expiring' | 'credential_expired' | 'credential_revoked' | 'issuer_degradation';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface MonitoringAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  npi: string;
  title: string;
  description: string;
  daysRemaining?: number;
  detectedAt: string;
}

// ── Alert Generation ──────────────────────────────────────────────────

function fromExpirationAlert(ea: ExpirationAlert): MonitoringAlert {
  const isExpired = ea.severity === 'EXPIRED';
  return {
    id: `exp-${ea.artifactId}`,
    type: isExpired ? 'credential_expired' : 'license_expiring',
    severity: ea.severity === 'EXPIRED' ? 'CRITICAL' : ea.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
    npi: ea.npi,
    title: isExpired ? `${ea.source} has expired` : `${ea.source} expires in ${ea.daysRemaining} days`,
    description: `Credential from ${ea.source} ${isExpired ? 'expired' : 'is approaching expiration'}. Status: ${ea.status}.`,
    daysRemaining: ea.daysRemaining,
    detectedAt: new Date().toISOString(),
  };
}

function fromRevocationSignal(rs: RevocationSignal): MonitoringAlert {
  return {
    id: `rev-${rs.artifactId}-${rs.detectedAt}`,
    type: 'credential_revoked',
    severity: 'CRITICAL',
    npi: rs.npi,
    title: `Revocation detected: ${rs.source}`,
    description: `Status changed from ${rs.previousState} to ${rs.currentState}.`,
    detectedAt: rs.detectedAt,
  };
}

// ── Main Aggregator ───────────────────────────────────────────────────

export async function generateAlerts(): Promise<MonitoringAlert[]> {
  const [expirations, revocations] = await Promise.all([
    scanExpirations(),
    detectRevocationSignals(),
  ]);

  const alerts: MonitoringAlert[] = [
    ...expirations.map(fromExpirationAlert),
    ...revocations.map(fromRevocationSignal),
  ];

  // Sort by severity then date
  const sevOrder: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  log('info', 'alert_engine: generated', { total: alerts.length, expirations: expirations.length, revocations: revocations.length });
  return alerts;
}

/**
 * Get alerts for a specific NPI.
 */
export async function getAlertsByNpi(npi: string): Promise<MonitoringAlert[]> {
  const all = await generateAlerts();
  return all.filter((a) => a.npi === npi);
}
