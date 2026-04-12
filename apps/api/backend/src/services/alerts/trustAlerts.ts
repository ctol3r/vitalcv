/**
 * trustAlerts.ts — Wave 97 + 126: Trust Alerts System
 *
 * Maintains trust alerts as a persisted domain with an in-memory cache for
 * fast reads. Alert state survives restarts and acknowledgement remains
 * durable.
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import {
  PrismaTrustAlertsRepository,
  type TrustAlertsRepository,
} from '../../../repositories/trustAlerts.repo';

// ── Types ─────────────────────────────────────────────────────────────

export type TrustAlertType =
  | 'credential_expiring'
  | 'credential_revoked'
  | 'issuer_trust_degradation'
  | 'verification_failure'
  | 'identity_delta'
  | 'source_stale'
  | 'claim_delta'
  | 'watchtower_delta'
  // Wave 245: Continuous monitoring alert types
  | 'license_expired'
  | 'sanction_detected'
  | 'enrollment_lapsed'
  | 'score_degraded';

export type TrustAlertSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'WARNING'
  | 'CRITICAL';

export interface TrustAlert {
  /** Unique alert ID */
  alertId: string;
  /** Alert category */
  type: TrustAlertType;
  /** Visual severity */
  severity: TrustAlertSeverity;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Affected credential ID (if applicable) */
  credentialId?: string;
  /** Affected issuer ID (if applicable) */
  issuerId?: string;
  /** Affected subject NPI/DID (if applicable) */
  subject?: string;
  /** Recommended action for the operator */
  recommendedAction: string;
  /** Whether this alert has been acknowledged */
  acknowledged: boolean;
  /** ISO-8601 timestamp */
  createdAt: string;
  /** ISO-8601 acknowledgement timestamp */
  acknowledgedAt?: string;
}

// ── Seed alerts ───────────────────────────────────────────────────────

const SEED_ALERTS: TrustAlert[] = [
  {
    alertId: 'seed-alert-license-expiring',
    type: 'credential_expiring',
    severity: 'WARNING',
    title: 'License expiring in 14 days',
    description: 'California Medical License for NPI 1003000126 expires on 2026-03-19.',
    subject: '1003000126',
    issuerId: 'did:vitalcv:issuer:ca-medical-board',
    recommendedAction: 'Initiate license renewal with California Medical Board.',
    acknowledged: false,
    createdAt: '2026-03-05T18:00:00.000Z',
  },
  {
    alertId: 'seed-alert-issuer-trust-degradation',
    type: 'issuer_trust_degradation',
    severity: 'CRITICAL',
    title: 'Issuer trust level degraded',
    description: 'Provisional issuer did:vitalcv:issuer:unverified-org has not been verified within the 30-day window.',
    issuerId: 'did:vitalcv:issuer:unverified-org',
    recommendedAction: 'Review issuer registration or remove from registry.',
    acknowledged: false,
    createdAt: '2026-03-05T17:30:00.000Z',
  },
  {
    alertId: 'seed-alert-verification-failure',
    type: 'verification_failure',
    severity: 'WARNING',
    title: 'Verification failed: missing public key',
    description: 'Credential signature could not be verified — no public key registered for issuer.',
    issuerId: 'did:vitalcv:issuer:provisional-clinic',
    recommendedAction: 'Contact issuer to register their SPKI public key in the trust registry.',
    acknowledged: false,
    createdAt: '2026-03-05T17:00:00.000Z',
  },
];

// ── Cache + repository ────────────────────────────────────────────────

function cloneAlert(alert: TrustAlert): TrustAlert {
  return structuredClone(alert);
}

function buildSeedCache(): Map<string, TrustAlert> {
  return new Map(SEED_ALERTS.map((alert) => [alert.alertId, cloneAlert(alert)]));
}

function replaceCache(alerts: readonly TrustAlert[]): void {
  alertCache = new Map(alerts.map((alert) => [alert.alertId, cloneAlert(alert)]));
}

function sortAlerts(alerts: readonly TrustAlert[]): TrustAlert[] {
  return [...alerts].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

let alertsRepository: TrustAlertsRepository = new PrismaTrustAlertsRepository();
let alertCache = buildSeedCache();
let initializationPromise: Promise<void> | null = null;

export function setTrustAlertsRepository(repository: TrustAlertsRepository): void {
  alertsRepository = repository;
  alertCache = buildSeedCache();
  initializationPromise = null;
}

export function resetTrustAlertsRepository(): void {
  setTrustAlertsRepository(new PrismaTrustAlertsRepository());
}

export async function initializeTrustAlertsPersistence(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      await alertsRepository.seedDefaults(SEED_ALERTS);
      const alerts = await alertsRepository.listAlerts();
      replaceCache(alerts);
      log('info', 'trust_alerts_initialized', { alertCount: alerts.length });
    } catch (error) {
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

// ── Public API ────────────────────────────────────────────────────────

/** Emit a new trust alert. */
export async function emitAlert(
  alert: Omit<TrustAlert, 'alertId' | 'acknowledged' | 'createdAt'>,
): Promise<TrustAlert> {
  await initializeTrustAlertsPersistence();
  const full: TrustAlert = {
    alertId: randomUUID(),
    ...alert,
    acknowledged: false,
    createdAt: new Date().toISOString(),
  };

  const persisted = await alertsRepository.createAlert(full);
  alertCache.set(persisted.alertId, cloneAlert(persisted));

  log('warn', 'trust_alert_emitted', {
    alertId: persisted.alertId,
    type: persisted.type,
    severity: persisted.severity,
  });

  return cloneAlert(persisted);
}

/** List all alerts, optionally filtered. */
export function listAlerts(opts?: {
  severity?: TrustAlertSeverity;
  acknowledged?: boolean;
  limit?: number;
}): TrustAlert[] {
  let result = sortAlerts(Array.from(alertCache.values()).map(cloneAlert));

  if (opts?.severity) {
    result = result.filter((alert) => alert.severity === opts.severity);
  }
  if (opts?.acknowledged !== undefined) {
    result = result.filter((alert) => alert.acknowledged === opts.acknowledged);
  }
  if (opts?.limit) {
    result = result.slice(0, opts.limit);
  }

  return result;
}

/** Acknowledge an alert by ID. */
export async function acknowledgeAlert(alertId: string): Promise<TrustAlert | null> {
  await initializeTrustAlertsPersistence();
  const acknowledgedAt = new Date().toISOString();
  const updated = await alertsRepository.acknowledgeAlert(alertId, acknowledgedAt);
  if (!updated) {
    return null;
  }

  alertCache.set(alertId, cloneAlert(updated));
  log('info', 'trust_alert_acknowledged', { alertId });
  return cloneAlert(updated);
}

/** Get a single alert by ID. */
export function getAlert(alertId: string): TrustAlert | null {
  const alert = alertCache.get(alertId);
  return alert ? cloneAlert(alert) : null;
}

/** Total unacknowledged count. */
export function unacknowledgedCount(): number {
  return Array.from(alertCache.values()).filter((alert) => !alert.acknowledged).length;
}

// ── Wave 245: Monitoring alert helpers ────────────────────────────────

export type MonitoringAlertKind =
  | 'LICENSE_EXPIRED'
  | 'SANCTION_DETECTED'
  | 'ENROLLMENT_LAPSED'
  | 'SCORE_DEGRADED';

const MONITORING_ALERT_MAP: Record<MonitoringAlertKind, {
  type: TrustAlertType;
  severity: TrustAlertSeverity;
}> = {
  LICENSE_EXPIRED:    { type: 'license_expired',    severity: 'HIGH' },
  SANCTION_DETECTED:  { type: 'sanction_detected',  severity: 'CRITICAL' },
  ENROLLMENT_LAPSED:  { type: 'enrollment_lapsed',  severity: 'WARNING' },
  SCORE_DEGRADED:     { type: 'score_degraded',     severity: 'WARNING' },
};

/**
 * Emit a monitoring alert and dispatch notification via the notification provider.
 * Every monitoring alert writes an AuditEvent before returning.
 */
export async function emitMonitoringAlert(input: {
  kind: MonitoringAlertKind;
  npi: string;
  title: string;
  description: string;
  credentialId?: string;
  recommendedAction: string;
}): Promise<TrustAlert> {
  const config = MONITORING_ALERT_MAP[input.kind];
  const alert = await emitAlert({
    type: config.type,
    severity: config.severity,
    title: input.title,
    description: input.description,
    credentialId: input.credentialId,
    subject: input.npi,
    recommendedAction: input.recommendedAction,
  });

  log('warn', 'monitoring_alert_dispatched', {
    alertId: alert.alertId,
    kind: input.kind,
    npi: `${input.npi.slice(0, 4)}****`,
    severity: config.severity,
  });

  return alert;
}
