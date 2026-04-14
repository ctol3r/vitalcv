// ── CA PA State Board Adapter ─────────────────────────────────────
// First authority wedge. No public API — requires manual/push model.

import type { SourceAdapter, SourceCheckResult, SourceClaim, SourceLimitation, MatchResult, ErrorClass } from '../types';
import { SourceStatus } from '../types';

export class CaPaBoardAdapter implements SourceAdapter {
  readonly sourceId = 'CA_PA_BOARD';
  readonly laneType = 'licensure' as const;
  readonly cadence = 7 * 24 * 60 * 60 * 1000;        // 7 days
  readonly freshnessTtl = 30 * 24 * 60 * 60 * 1000;  // 30 days
  readonly authMode = 'manual' as const;
  readonly matchMode = 'name_npi' as const;
  readonly parserVersion = 'ca-pa-board-v1';

  // State boards have no public API. This adapter represents the PUSH model
  // where license data is manually submitted or ingested via partnership.
  async fetch(_subject: string): Promise<SourceCheckResult> {
    return {
      sourceId: this.sourceId,
      laneType: this.laneType,
      status: SourceStatus.ACCESS_REQUIRED,
      claims: [],
      limitations: [{
        code: 'MANUAL_SOURCE',
        description: 'CA PA Board requires manual credential submission or direct state partnership. No public API available.',
        adverse: false,
      }],
      matchBasis: {
        mode: this.matchMode,
        confidence: 'unresolved',
        explanation: 'CA PA Board check requires manual intervention — cannot auto-verify',
      },
      observedAt: null,
      checkedAt: new Date().toISOString(),
      rawHash: null,
      parserVersion: this.parserVersion,
      errorClass: null,
    };
  }

  normalize(raw: unknown): Record<string, unknown> {
    // Expected push payload structure when license data is manually submitted
    const data = raw as Record<string, unknown> | null;
    if (!data) return { found: false, license: null };

    return {
      found: true,
      license: {
        licenseNumber: data.license_number || null,
        licenseType: data.license_type || null,
        status: data.status || null,
        issueDate: data.issue_date || null,
        expirationDate: data.expiration_date || null,
        state: 'CA',
        discipline: data.discipline || null,
      },
      lastUpdated: data.last_updated || null,
    };
  }

  classify(normalized: Record<string, unknown>): SourceStatus {
    if ((normalized as any).found === false) return SourceStatus.UNAVAILABLE;
    const license = (normalized as any).license as Record<string, unknown> | null;
    if (!license) return SourceStatus.UNAVAILABLE;

    const status = String(license.status || '').toUpperCase();
    if (status === 'ACTIVE' || status === 'CURRENT' || status === 'CLEAR') {
      return SourceStatus.CHECKED;
    }
    if (status === 'REVOKED' || status === 'SUSPENDED' || status === 'DENIED') {
      return SourceStatus.BLOCKED_SIGNAL;
    }
    return SourceStatus.REVIEW_REQUIRED;
  }

  buildClaims(normalized: Record<string, unknown>): SourceClaim[] {
    const license = (normalized as any).license as Record<string, unknown> | null;
    if (!license) return [{ key: 'state_license', value: 'not_submitted', present: false }];

    return [
      { key: 'state_license', value: 'verified', present: true },
      { key: 'license_number', value: license.licenseNumber, present: !!license.licenseNumber },
      { key: 'license_type', value: license.licenseType, present: !!license.licenseType },
      { key: 'license_status', value: license.status, present: !!license.status },
      { key: 'license_state', value: 'CA', present: true },
      { key: 'expiration_date', value: license.expirationDate, present: !!license.expirationDate },
      { key: 'has_discipline', value: !!license.discipline, present: license.discipline !== undefined },
    ];
  }

  buildLimitations(normalized: Record<string, unknown>): SourceLimitation[] {
    const limitations: SourceLimitation[] = [];
    const license = (normalized as any).license as Record<string, unknown> | null;

    if (!license) {
      limitations.push({
        code: 'LICENSE_NOT_SUBMITTED',
        description: 'No CA PA license data has been submitted for this clinician',
        adverse: false,
      });
      return limitations;
    }

    const status = String(license.status || '').toUpperCase();
    if (status === 'REVOKED' || status === 'SUSPENDED') {
      limitations.push({
        code: 'LICENSE_ADVERSE',
        description: `CA PA license status: ${status}`,
        adverse: true,
      });
    }

    if (license.discipline) {
      limitations.push({
        code: 'LICENSE_DISCIPLINE',
        description: `Disciplinary action on file: ${license.discipline}`,
        adverse: true,
      });
    }

    if (license.expirationDate && new Date(license.expirationDate as string) < new Date()) {
      limitations.push({
        code: 'LICENSE_EXPIRED',
        description: `CA PA license expired: ${license.expirationDate}`,
        adverse: true,
      });
    }

    return limitations;
  }

  buildReceiptPayload(normalized: Record<string, unknown>): Record<string, unknown> {
    return {
      source: this.sourceId,
      version: this.parserVersion,
      observedAt: (normalized as any).lastUpdated || null,
      claims: {
        license: (normalized as any).license || null,
      },
    };
  }

  async healthcheck(): Promise<{ healthy: boolean; errorClass: ErrorClass | null; latencyMs: number }> {
    // Manual source — always "healthy" but with ACCESS_REQUIRED caveat
    return {
      healthy: false,
      errorClass: null,
      latencyMs: 0,
    };
  }
}
