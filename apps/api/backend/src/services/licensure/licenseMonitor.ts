/**
 * licenseMonitor.ts — Wave 65: Licensure Expiration Monitor
 *
 * Tracks state medical licenses, DEA registrations, and board certifications.
 * Triggers alerts at 120, 60, and 30 day thresholds.
 */

import type { ClinicianProfile } from '../clinician/intelligenceEngine';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ExpirationAlert {
  credentialType: 'license' | 'dea' | 'board' | 'other';
  credentialName: string;
  state?: string;
  expiresAt: string;
  daysUntilExpiry: number;
  severity: 'critical' | 'warning' | 'info';
}

// ── Thresholds ────────────────────────────────────────────────────────────

const THRESHOLDS = [
  { days: 30, severity: 'critical' as const },
  { days: 60, severity: 'warning' as const },
  { days: 120, severity: 'info' as const },
];

// ── Monitor ───────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getSeverity(days: number): ExpirationAlert['severity'] | null {
  for (const t of THRESHOLDS) {
    if (days <= t.days) return t.severity;
  }
  return null;
}

export function checkExpirations(profile: ClinicianProfile): ExpirationAlert[] {
  const alerts: ExpirationAlert[] = [];

  // State licenses
  for (const license of profile.stateLicenses) {
    if (!license.expiresAt) continue;
    const days = daysUntil(license.expiresAt);
    const severity = getSeverity(days);
    if (severity && days > 0) {
      alerts.push({
        credentialType: 'license',
        credentialName: `${license.state} Medical License`,
        state: license.state,
        expiresAt: license.expiresAt,
        daysUntilExpiry: days,
        severity,
      });
    }
  }

  // DEA
  if (profile.deaRegistration?.expiresAt) {
    const days = daysUntil(profile.deaRegistration.expiresAt);
    const severity = getSeverity(days);
    if (severity && days > 0) {
      alerts.push({
        credentialType: 'dea',
        credentialName: 'DEA Registration',
        expiresAt: profile.deaRegistration.expiresAt,
        daysUntilExpiry: days,
        severity,
      });
    }
  }

  // Board certification
  if (profile.boardCertification?.expiresAt) {
    const days = daysUntil(profile.boardCertification.expiresAt);
    const severity = getSeverity(days);
    if (severity && days > 0) {
      alerts.push({
        credentialType: 'board',
        credentialName: `${profile.boardCertification.board} Certification`,
        expiresAt: profile.boardCertification.expiresAt,
        daysUntilExpiry: days,
        severity,
      });
    }
  }

  // Generic credentials
  for (const cred of profile.credentials) {
    if (!cred.expiresAt) continue;
    // Skip duplicates already captured above
    const src = cred.source.toLowerCase();
    if (src.includes('license') || src.includes('dea') || src.includes('board')) continue;

    const days = daysUntil(cred.expiresAt);
    const severity = getSeverity(days);
    if (severity && days > 0) {
      alerts.push({
        credentialType: 'other',
        credentialName: cred.source,
        expiresAt: cred.expiresAt,
        daysUntilExpiry: days,
        severity,
      });
    }
  }

  // Sort by urgency
  alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  return alerts;
}
