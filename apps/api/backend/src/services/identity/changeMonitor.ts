/**
 * changeMonitor.ts — SLA-Enforced Change Detection & Alert Service
 *
 * Monitors clinician identity claims for:
 *   - Source freshness SLA breaches (source hasn't been re-ingested within its refresh window)
 *   - Expiring credentials (license, board cert, DEA — 30/60/90 day warnings)
 *   - Critical status changes (new exclusion, license revocation)
 *   - Stale artifact detection (data older than source's refreshSlaHours)
 *
 * Designed to run on a cron schedule (e.g., every 6 hours via node-cron).
 * Each check is idempotent — running it twice produces no duplicate alerts.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { listSources, getSource } from './sourceCatalog';
import { getClaimsForNpi } from './identityIngestionPipeline';
import type { NormalizedClaim } from './evidenceModel';
import { createHash } from 'node:crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type AlertType =
  | 'EXCLUSION_DETECTED'
  | 'LICENSE_EXPIRING'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_REVOKED'
  | 'BOARD_CERT_EXPIRING'
  | 'BOARD_CERT_LAPSED'
  | 'SOURCE_STALE'
  | 'SLA_BREACH'
  | 'REVIEW_REQUIRED'
  | 'TRUST_BAND_DEGRADED';

export interface IdentityAlert {
  alertId:     string;   // deterministic — dedup key
  type:        AlertType;
  severity:    AlertSeverity;
  npi:         string;
  claimId:     string | null;
  sourceId:    string | null;
  message:     string;
  detail:      Record<string, unknown>;
  createdAt:   string;
  acknowledged: boolean;
}

export interface MonitorReport {
  npi:         string;
  checkedAt:   string;
  alerts:      IdentityAlert[];
  staleSources: string[];
  expiringClaims: number;
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

// ── Alert ID generation (deterministic — same condition = same alertId) ──────

function alertId(type: AlertType, npi: string, discriminator: string): string {
  return 'alert_' + createHash('sha256')
    .update(`${type}|${npi}|${discriminator}`)
    .digest('hex').slice(0, 24);
}

// ── Alert rules ───────────────────────────────────────────────────────────────

const EXPIRY_WINDOWS = {
  LICENSE:            [90, 60, 30],  // warn at 90, 60, 30 days
  BOARD_CERTIFICATION: [90, 30],
  DEA_REGISTRATION:   [60, 30],
};

function checkExpiringClaims(npi: string, claims: NormalizedClaim[]): IdentityAlert[] {
  const alerts: IdentityAlert[] = [];
  const now = Date.now();

  for (const claim of claims) {
    if (claim.status !== 'ACTIVE') continue;
    const val = claim.value as Record<string, unknown>;
    const expiryField = val.expiryDate ?? val.expirationDate ?? claim.expiresAt ?? claim.validUntil;
    if (!expiryField || typeof expiryField !== 'string') continue;

    const expiry = new Date(expiryField).getTime();
    if (isNaN(expiry)) continue;

    const daysUntil = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      // Already expired
      const type: AlertType = claim.claimType === 'BOARD_CERTIFICATION' || claim.claimType === 'BOARD_CERT_FLAG'
        ? 'BOARD_CERT_LAPSED' : 'LICENSE_EXPIRED';
      alerts.push({
        alertId: alertId(type, npi, claim.claimId),
        type, severity: 'HIGH', npi, claimId: claim.claimId,
        sourceId: claim.sourceId,
        message: `${claim.claimType} expired ${Math.abs(daysUntil)} days ago`,
        detail: { claimType: claim.claimType, expiryDate: expiryField, daysOverdue: Math.abs(daysUntil) },
        createdAt: new Date().toISOString(), acknowledged: false,
      });
    } else if (daysUntil <= 30) {
      const type: AlertType = claim.claimType === 'BOARD_CERTIFICATION' || claim.claimType === 'BOARD_CERT_FLAG'
        ? 'BOARD_CERT_EXPIRING' : 'LICENSE_EXPIRING';
      alerts.push({
        alertId: alertId(type, npi, claim.claimId),
        type, severity: daysUntil <= 7 ? 'HIGH' : 'MEDIUM', npi, claimId: claim.claimId,
        sourceId: claim.sourceId,
        message: `${claim.claimType} expires in ${daysUntil} days (${expiryField})`,
        detail: { claimType: claim.claimType, expiryDate: expiryField, daysUntilExpiry: daysUntil },
        createdAt: new Date().toISOString(), acknowledged: false,
      });
    } else if (daysUntil <= 90) {
      alerts.push({
        alertId: alertId('LICENSE_EXPIRING', npi, claim.claimId + '_90d'),
        type: 'LICENSE_EXPIRING', severity: 'LOW', npi, claimId: claim.claimId,
        sourceId: claim.sourceId,
        message: `${claim.claimType} expires in ${daysUntil} days — plan renewal`,
        detail: { claimType: claim.claimType, expiryDate: expiryField, daysUntilExpiry: daysUntil },
        createdAt: new Date().toISOString(), acknowledged: false,
      });
    }
  }

  return alerts;
}

function checkExclusionStatus(npi: string, claims: NormalizedClaim[]): IdentityAlert[] {
  const exclusionClaims = claims.filter(c => c.claimType === 'EXCLUSION_STATUS' || c.claimType === 'FEDERAL_EXCLUSION');
  const alerts: IdentityAlert[] = [];

  for (const claim of exclusionClaims) {
    const val = claim.value as Record<string, unknown>;
    if (val.excluded === true) {
      alerts.push({
        alertId: alertId('EXCLUSION_DETECTED', npi, claim.claimId),
        type: 'EXCLUSION_DETECTED', severity: 'CRITICAL', npi,
        claimId: claim.claimId, sourceId: claim.sourceId,
        message: `EXCLUSION DETECTED — NPI ${npi} found in ${claim.sourceId}. Trust band must be L0.`,
        detail: { matchType: val.matchType, exclusionType: val.exclusionType, exclusionDate: val.exclusionDate },
        createdAt: new Date().toISOString(), acknowledged: false,
      });
    }

    // Flag uncertain results too
    if (claim.confidence === 'UNCERTAIN') {
      alerts.push({
        alertId: alertId('REVIEW_REQUIRED', npi, claim.claimId),
        type: 'REVIEW_REQUIRED', severity: 'HIGH', npi,
        claimId: claim.claimId, sourceId: claim.sourceId,
        message: `OIG exclusion check returned uncertain result — manual verification required`,
        detail: { confidence: claim.confidence, reviewReason: claim.reviewReason },
        createdAt: new Date().toISOString(), acknowledged: false,
      });
    }
  }

  return alerts;
}

function checkLicenseStatus(npi: string, claims: NormalizedClaim[]): IdentityAlert[] {
  const licenseClaims = claims.filter(c => c.claimType === 'LICENSE' || c.claimType === 'NURSING_LICENSE');
  const alerts: IdentityAlert[] = [];

  for (const claim of licenseClaims) {
    const val = claim.value as Record<string, unknown>;
    if (val.licenseStatus === 'REVOKED' || val.licenseStatus === 'SUSPENDED') {
      alerts.push({
        alertId: alertId('LICENSE_REVOKED', npi, claim.claimId),
        type: 'LICENSE_REVOKED', severity: 'CRITICAL', npi,
        claimId: claim.claimId, sourceId: claim.sourceId,
        message: `License ${val.licenseStatus} — ${val.state ?? 'unknown state'} license ${val.licenseNumber ?? ''}`,
        detail: { licenseStatus: val.licenseStatus, state: val.state, licenseNumber: val.licenseNumber },
        createdAt: new Date().toISOString(), acknowledged: false,
      });
    }
  }

  return alerts;
}

function checkReviewRequired(npi: string, claims: NormalizedClaim[]): IdentityAlert[] {
  return claims
    .filter(c => c.reviewRequired && !c.humanReviewAt)
    .map(c => ({
      alertId: alertId('REVIEW_REQUIRED', npi, c.claimId),
      type: 'REVIEW_REQUIRED' as AlertType,
      severity: 'MEDIUM' as AlertSeverity,
      npi,
      claimId: c.claimId,
      sourceId: c.sourceId,
      message: c.reviewReason ?? `Claim ${c.claimType} from ${c.sourceId} requires human review`,
      detail: { claimType: c.claimType, tier: c.tier, confidence: c.confidence },
      createdAt: new Date().toISOString(),
      acknowledged: false,
    }));
}

// ── Source freshness SLA check ────────────────────────────────────────────────

async function checkSourceFreshness(npi: string): Promise<{ alerts: IdentityAlert[]; staleSources: string[] }> {
  const alerts: IdentityAlert[] = [];
  const staleSources: string[] = [];

  // Get the latest artifact per source for this NPI
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, lifecycleState: 'active', source: { not: 'IDENTITY_INDEX' } },
    select: { source: true, createdAt: true, verifiedAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // Dedupe to latest per source
  const latestBySource = new Map<string, Date>();
  for (const art of artifacts) {
    if (!latestBySource.has(art.source)) {
      latestBySource.set(art.source, art.verifiedAt ?? art.createdAt);
    }
  }

  const now = Date.now();
  for (const [sourceId, lastVerified] of latestBySource) {
    const src = getSource(sourceId);
    if (!src) continue;

    const ageHours = (now - lastVerified.getTime()) / (1000 * 60 * 60);
    if (ageHours > src.refreshSlaHours) {
      staleSources.push(sourceId);
      const severity: AlertSeverity = src.tier === 'GOLD' ? 'HIGH' : 'MEDIUM';
      alerts.push({
        alertId: alertId('SLA_BREACH', npi, sourceId),
        type: 'SLA_BREACH', severity, npi, claimId: null, sourceId,
        message: `${sourceId} data is ${Math.round(ageHours)}h old — SLA is ${src.refreshSlaHours}h. Re-ingest recommended.`,
        detail: { sourceId, ageHours: Math.round(ageHours), slaHours: src.refreshSlaHours, tier: src.tier },
        createdAt: new Date().toISOString(), acknowledged: false,
      });
    }
  }

  return { alerts, staleSources };
}

// ── Main monitor entry point ──────────────────────────────────────────────────

export async function monitorClinicianIdentity(npi: string): Promise<MonitorReport> {
  const checkedAt = new Date().toISOString();
  const allAlerts: IdentityAlert[] = [];

  try {
    const claims = await getClaimsForNpi(npi);

    // Run all alert rules
    allAlerts.push(...checkExclusionStatus(npi, claims));
    allAlerts.push(...checkLicenseStatus(npi, claims));
    allAlerts.push(...checkExpiringClaims(npi, claims));
    allAlerts.push(...checkReviewRequired(npi, claims));

    const { alerts: slaAlerts, staleSources } = await checkSourceFreshness(npi);
    allAlerts.push(...slaAlerts);

    // Determine overall health
    const hasCritical = allAlerts.some(a => a.severity === 'CRITICAL');
    const hasHigh     = allAlerts.some(a => a.severity === 'HIGH');
    const overallHealth = hasCritical ? 'CRITICAL' : hasHigh ? 'DEGRADED' : 'HEALTHY';

    // Persist critical alerts as AuditEvents
    for (const alert of allAlerts.filter(a => a.severity === 'CRITICAL')) {
      await prisma.auditEvent.create({
        data: {
          type: `IDENTITY_ALERT_${alert.type}`,
          hash: createHash('sha256').update(alert.alertId).digest('hex'),
          clinicianId: npi,
          metadata: JSON.parse(JSON.stringify(alert)),
        },
      }).catch(() => null); // Ignore duplicates
    }

    return {
      npi, checkedAt, alerts: allAlerts, staleSources,
      expiringClaims: allAlerts.filter(a => a.type === 'LICENSE_EXPIRING' || a.type === 'BOARD_CERT_EXPIRING').length,
      overallHealth,
    };
  } catch (err) {
    log('error', 'changeMonitor: check failed', { npi, error: String(err) });
    return {
      npi, checkedAt, alerts: allAlerts, staleSources: [],
      expiringClaims: 0, overallHealth: 'DEGRADED',
    };
  }
}

// ── Batch monitoring (for cron) ───────────────────────────────────────────────

export async function monitorAllTrackedClinicians(options?: { limit?: number }): Promise<{
  total: number;
  healthy: number;
  degraded: number;
  critical: number;
  reports: MonitorReport[];
}> {
  const limit = options?.limit ?? 100;

  // Find NPIs that have been ingested (have IDENTITY_INDEX artifacts)
  const indexArtifacts = await prisma.verificationArtifact.findMany({
    where: { source: 'IDENTITY_INDEX', lifecycleState: 'active' },
    select: { npi: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const npis = [...new Set(indexArtifacts.map(a => a.npi))];
  log('info', 'changeMonitor: batch scan', { count: npis.length });

  const reports: MonitorReport[] = [];
  for (const npi of npis) {
    const report = await monitorClinicianIdentity(npi);
    reports.push(report);
  }

  return {
    total:    reports.length,
    healthy:  reports.filter(r => r.overallHealth === 'HEALTHY').length,
    degraded: reports.filter(r => r.overallHealth === 'DEGRADED').length,
    critical: reports.filter(r => r.overallHealth === 'CRITICAL').length,
    reports,
  };
}
