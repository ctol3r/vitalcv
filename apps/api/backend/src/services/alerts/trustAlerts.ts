/**
 * trustAlerts.ts — Wave 97: Trust Alerts System
 *
 * Maintains an in-memory store of trust-related alerts:
 * credential_expiring, credential_revoked, issuer_trust_degradation,
 * and verification_failure. Supports acknowledgement.
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type TrustAlertType =
  | 'credential_expiring'
  | 'credential_revoked'
  | 'issuer_trust_degradation'
  | 'verification_failure';

export type TrustAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

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

// ── Storage ───────────────────────────────────────────────────────────

const alerts = new Map<string, TrustAlert>();

// ── Seed demo alerts ──────────────────────────────────────────────────

const SEED_ALERTS: Omit<TrustAlert, 'alertId' | 'acknowledged' | 'createdAt'>[] = [
  {
    type: 'credential_expiring',
    severity: 'WARNING',
    title: 'License expiring in 14 days',
    description: 'California Medical License for NPI 1003000126 expires on 2026-03-19.',
    subject: '1003000126',
    issuerId: 'did:vitalcv:issuer:ca-medical-board',
    recommendedAction: 'Initiate license renewal with California Medical Board.',
  },
  {
    type: 'issuer_trust_degradation',
    severity: 'CRITICAL',
    title: 'Issuer trust level degraded',
    description: 'Provisional issuer did:vitalcv:issuer:unverified-org has not been verified within the 30-day window.',
    issuerId: 'did:vitalcv:issuer:unverified-org',
    recommendedAction: 'Review issuer registration or remove from registry.',
  },
  {
    type: 'verification_failure',
    severity: 'WARNING',
    title: 'Verification failed: missing public key',
    description: 'Credential signature could not be verified — no public key registered for issuer.',
    issuerId: 'did:vitalcv:issuer:provisional-clinic',
    recommendedAction: 'Contact issuer to register their SPKI public key in the trust registry.',
  },
];

for (const seed of SEED_ALERTS) {
  const alert: TrustAlert = {
    alertId: randomUUID(),
    ...seed,
    acknowledged: false,
    createdAt: new Date(Date.now() - Math.random() * 3_600_000).toISOString(),
  };
  alerts.set(alert.alertId, alert);
}

// ── Public API ────────────────────────────────────────────────────────

/** Emit a new trust alert. */
export function emitAlert(
  alert: Omit<TrustAlert, 'alertId' | 'acknowledged' | 'createdAt'>,
): TrustAlert {
  const full: TrustAlert = {
    alertId: randomUUID(),
    ...alert,
    acknowledged: false,
    createdAt: new Date().toISOString(),
  };
  alerts.set(full.alertId, full);

  log('warn', 'trust_alert_emitted', {
    alertId: full.alertId,
    type: full.type,
    severity: full.severity,
  });

  return full;
}

/** List all alerts, optionally filtered. */
export function listAlerts(opts?: {
  severity?: TrustAlertSeverity;
  acknowledged?: boolean;
  limit?: number;
}): TrustAlert[] {
  let result = Array.from(alerts.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (opts?.severity) result = result.filter((a) => a.severity === opts.severity);
  if (opts?.acknowledged !== undefined) result = result.filter((a) => a.acknowledged === opts.acknowledged);
  if (opts?.limit) result = result.slice(0, opts.limit);

  return result;
}

/** Acknowledge an alert by ID. */
export function acknowledgeAlert(alertId: string): TrustAlert | null {
  const alert = alerts.get(alertId);
  if (!alert) return null;

  const updated: TrustAlert = {
    ...alert,
    acknowledged: true,
    acknowledgedAt: new Date().toISOString(),
  };
  alerts.set(alertId, updated);

  log('info', 'trust_alert_acknowledged', { alertId });
  return updated;
}

/** Get a single alert by ID. */
export function getAlert(alertId: string): TrustAlert | null {
  return alerts.get(alertId) ?? null;
}

/** Total unacknowledged count. */
export function unacknowledgedCount(): number {
  return Array.from(alerts.values()).filter((a) => !a.acknowledged).length;
}
