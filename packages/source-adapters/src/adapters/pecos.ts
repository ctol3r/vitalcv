// ── PECOS Source Adapters ─────────────────────────────────────────
// Split into ordering/referring and enrollment lanes.

import type { SourceAdapter, SourceCheckResult, SourceClaim, SourceLimitation, MatchResult, ErrorClass, LaneType } from '../types';
import { SourceStatus } from '../types';
import { sha256Sync } from '../utils/hash';

const PECOS_API = 'https://data.cms.gov/provider-data/api/1/datastore/ids/';

function pecosBaseConfig(laneType: LaneType, pecosVariant: string): {
  sourceId: string; laneType: LaneType; parserVersion: string;
} {
  return {
    sourceId: pecosVariant === 'ordering' ? 'PECOS_ORDERING' : 'PECOS_ENROLLMENT',
    laneType,
    parserVersion: `pecos-${pecosVariant}-v1`,
  };
}

abstract class BasePecosAdapter implements SourceAdapter {
  abstract readonly sourceId: string;
  readonly laneType: LaneType = 'enrollment';
  readonly cadence = 24 * 60 * 60 * 1000;
  readonly freshnessTtl = 7 * 24 * 60 * 60 * 1000;
  readonly authMode = 'none' as const;
  readonly matchMode = 'npi_exact' as const;
  abstract readonly parserVersion: string;
  abstract readonly pecosVariant: 'ordering' | 'enrollment';

  abstract pecosEndpoint(): string;

  async fetch(npi: string): Promise<SourceCheckResult> {
    const checkedAt = new Date().toISOString();
    let raw: unknown;
    let errorClass: ErrorClass | null = null;

    try {
      const url = `${this.pecosEndpoint()}?npi=${encodeURIComponent(npi)}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        errorClass = res.status >= 500 ? 'HTTP_5xx' : res.status === 429 ? 'RATE_LIMITED' : 'HTTP_4xx';
        return this.buildErrorResult(npi, checkedAt, errorClass, `${res.status} ${res.statusText}`);
      }

      raw = await res.json();
    } catch (err: any) {
      errorClass = err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? 'TIMEOUT'
        : err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED'
          ? 'NETWORK_ERROR'
          : 'UNKNOWN';
      return this.buildErrorResult(npi, checkedAt, errorClass, String(err?.message || err));
    }

    const rawHash = sha256Sync(JSON.stringify(raw));
    const normalized = this.normalize(raw);
    const status = this.classify(normalized);
    const claims = this.buildClaims(normalized);
    const limitations = this.buildLimitations(normalized);

    const enrolled = (normalized as any).enrolled === true;
    const matchBasis: MatchResult = {
      mode: this.matchMode,
      confidence: (normalized as any).found === true ? 'exact' : 'no_match',
      explanation: enrolled
        ? `NPI ${npi} found in PECOS (${this.pecosVariant}) — enrolled`
        : `NPI ${npi} not found or not enrolled in PECOS (${this.pecosVariant})`,
    };

    return {
      sourceId: this.sourceId,
      laneType: this.laneType,
      status,
      claims,
      limitations,
      matchBasis,
      observedAt: (normalized as any).lastUpdated || null,
      checkedAt,
      rawHash,
      parserVersion: this.parserVersion,
      errorClass: null,
    };
  }

  normalize(raw: unknown): Record<string, unknown> {
    const records = Array.isArray(raw) ? raw : (raw as any)?.results || [];
    const record = records[0];

    if (!record) {
      return { found: false, enrolled: false, enrollment: null, lastUpdated: null };
    }

    return {
      found: true,
      enrolled: true,
      enrollment: {
        npi: record.npi || null,
        name: record.name || record.provider_name || null,
        enrollmentStatus: record.enrollment_status || 'active',
        enrollmentDate: record.enrollment_date || null,
        specialty: record.specialty || record.primary_specialty || null,
        state: record.state || null,
        medicarePartB: record.medicare_part_b === true || record.part_b === true,
      },
      lastUpdated: record.last_updated || null,
    };
  }

  classify(normalized: Record<string, unknown>): SourceStatus {
    if ((normalized as any).found === false) return SourceStatus.UNAVAILABLE;
    if ((normalized as any).enrolled === true) return SourceStatus.CHECKED;
    return SourceStatus.UNAVAILABLE;
  }

  buildClaims(normalized: Record<string, unknown>): SourceClaim[] {
    const enrollment = (normalized as any).enrollment as Record<string, unknown> | null;
    if (!enrollment) return [{ key: 'pecos_enrollment', value: 'not_found', present: false }];

    return [
      { key: 'pecos_enrolled', value: true, present: true },
      { key: 'enrollment_status', value: enrollment.enrollmentStatus, present: !!enrollment.enrollmentStatus },
      { key: 'enrollment_date', value: enrollment.enrollmentDate, present: !!enrollment.enrollmentDate },
      { key: 'specialty', value: enrollment.specialty, present: !!enrollment.specialty },
      { key: 'state', value: enrollment.state, present: !!enrollment.state },
      { key: 'medicare_part_b', value: enrollment.medicarePartB, present: enrollment.medicarePartB !== undefined },
    ];
  }

  buildLimitations(normalized: Record<string, unknown>): SourceLimitation[] {
    const limitations: SourceLimitation[] = [];
    if ((normalized as any).found === false) {
      limitations.push({
        code: 'PECOS_NOT_FOUND',
        description: `NPI not found in PECOS (${this.pecosVariant})`,
        adverse: false,
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
        enrolled: (normalized as any).enrolled || false,
        enrollment: (normalized as any).enrollment || null,
      },
    };
  }

  async healthcheck(): Promise<{ healthy: boolean; errorClass: ErrorClass | null; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(this.pecosEndpoint(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      return { healthy: res.ok, errorClass: res.ok ? null : 'HTTP_5xx', latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, errorClass: 'NETWORK_ERROR', latencyMs: Date.now() - start };
    }
  }

  private buildErrorResult(npi: string, checkedAt: string, errorClass: ErrorClass, message: string): SourceCheckResult {
    return {
      sourceId: this.sourceId,
      laneType: this.laneType,
      status: SourceStatus.UNAVAILABLE,
      claims: [],
      limitations: [{ code: 'FETCH_FAILED', description: `PECOS check failed: ${message}`, adverse: false }],
      matchBasis: { mode: this.matchMode, confidence: 'unresolved', explanation: `PECOS (${this.pecosVariant}) check failed` },
      observedAt: null,
      checkedAt,
      rawHash: null,
      parserVersion: this.parserVersion,
      errorClass,
    };
  }
}

// ── Ordering/Referring ───────────────────────────────────────────

export class PecosOrderingAdapter extends BasePecosAdapter {
  readonly sourceId = 'PECOS_ORDERING';
  readonly parserVersion = 'pecos-ordering-v1';
  readonly pecosVariant = 'ordering' as const;

  pecosEndpoint(): string {
    return `${PECOS_API}mcmpn-uc4t?`;
  }
}

// ── Enrollment ───────────────────────────────────────────────────

export class PecosEnrollmentAdapter extends BasePecosAdapter {
  readonly sourceId = 'PECOS_ENROLLMENT';
  readonly parserVersion = 'pecos-enrollment-v1';
  readonly pecosVariant = 'enrollment' as const;

  pecosEndpoint(): string {
    return `${PECOS_API}qwer-3k4p?`;
  }
}
