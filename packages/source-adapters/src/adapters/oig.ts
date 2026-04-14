// ── OIG LEIE Source Adapter ───────────────────────────────────────
// Exclusion lane. NEVER defaults to "clear". Unresolved ≠ Clear.

import type { SourceAdapter, SourceCheckResult, SourceClaim, SourceLimitation, MatchResult, ErrorClass } from '../types';
import { SourceStatus } from '../types';
import { sha256Sync } from '../utils/hash';

const OIG_API = 'https://exclusions.oig.hhs.gov/api/exclusions';

export class OigLeieAdapter implements SourceAdapter {
  readonly sourceId = 'OIG_LEIE';
  readonly laneType = 'exclusion' as const;
  readonly cadence = 24 * 60 * 60 * 1000;
  readonly freshnessTtl = 24 * 60 * 60 * 1000; // Adverse data decays fast
  readonly authMode = 'none' as const;
  readonly matchMode = 'npi_exact' as const;
  readonly parserVersion = 'oig-leie-v1';

  async fetch(npi: string): Promise<SourceCheckResult> {
    const checkedAt = new Date().toISOString();
    let raw: unknown;
    let errorClass: ErrorClass | null = null;

    try {
      const url = `${OIG_API}/${encodeURIComponent(npi)}`;
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
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        errorClass = 'TIMEOUT';
      } else if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') {
        errorClass = 'NETWORK_ERROR';
      } else {
        errorClass = 'UNKNOWN';
      }
      return this.buildErrorResult(npi, checkedAt, errorClass, String(err?.message || err));
    }

    const rawHash = this.hashRaw(raw);
    const normalized = this.normalize(raw);
    const status = this.classify(normalized);
    const claims = this.buildClaims(normalized);
    const limitations = this.buildLimitations(normalized);

    // CRITICAL: never default to "clear". Explicitly state match result.
    const exclusionCount = (normalized.exclusions as any[])?.length || 0;
    let matchConfidence: MatchResult['confidence'];
    let explanation: string;

    if (exclusionCount === 0) {
      matchConfidence = 'exact';
      explanation = `NPI ${npi} checked against OIG LEIE — 0 exclusion records found`;
    } else {
      matchConfidence = 'exact';
      explanation = `NPI ${npi} has ${exclusionCount} exclusion record(s) in OIG LEIE`;
    }

    const matchBasis: MatchResult = {
      mode: this.matchMode,
      confidence: matchConfidence,
      explanation,
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
    const data = (raw as any)?.exclusions || (raw as any)?.results || [];
    const exclusions = Array.isArray(data) ? data : [];

    const normalizedExclusions = exclusions.map((e: any) => ({
      npi: e.npi || null,
      name: e.name || `${e.firstname || ''} ${e.lastname || ''}`.trim() || null,
      exclusionType: e.excltype || null,
      excludedDate: e.excl_date || null,
      reinstatedDate: e.reindate || null,
      waiverState: e.waiver_state || null,
      general: e.general === 'Y',
      exclusionReason: e.excl_reason || null,
      additionalInfo: e.additional_info || null,
    }));

    return {
      exclusions: normalizedExclusions,
      lastUpdated: (raw as any)?.last_updated || null,
      exclusionCount: normalizedExclusions.length,
    };
  }

  classify(normalized: Record<string, unknown>): SourceStatus {
    const count = normalized.exclusionCount as number || 0;

    if (count > 0) {
      // Check if all exclusions are reinstated
      const allReinstated = ((normalized.exclusions as any[]) || []).every(
        (e: any) => e.reinstatedDate !== null
      );
      if (allReinstated) {
        return SourceStatus.REVIEW_REQUIRED; // Was excluded, now reinstated — human review needed
      }
      return SourceStatus.BLOCKED_SIGNAL; // Active exclusion
    }

    return SourceStatus.CHECKED; // 0 records = clear
  }

  buildClaims(normalized: Record<string, unknown>): SourceClaim[] {
    const exclusions = (normalized.exclusions as any[]) || [];
    const hasActiveExclusion = exclusions.some((e: any) => !e.reinstatedDate);

    return [
      {
        key: 'oig_exclusion_check',
        value: 'performed',
        present: true,
      },
      {
        key: 'exclusion_count',
        value: normalized.exclusionCount || 0,
        present: true,
      },
      {
        key: 'has_active_exclusion',
        value: hasActiveExclusion,
        present: true,
      },
      {
        key: 'exclusions',
        value: exclusions,
        present: exclusions.length > 0,
      },
    ];
  }

  buildLimitations(normalized: Record<string, unknown>): SourceLimitation[] {
    const exclusions = (normalized.exclusions as any[]) || [];
    const limitations: SourceLimitation[] = [];

    for (const exc of exclusions) {
      if (exc.reinstatedDate) {
        limitations.push({
          code: 'OIG_REINSTATED',
          description: `Previously excluded (${exc.exclusionType}) — reinstated ${exc.reinstatedDate}`,
          adverse: false,
        });
      } else {
        limitations.push({
          code: 'OIG_EXCLUSION_ACTIVE',
          description: `Active OIG exclusion: ${exc.exclusionType} since ${exc.excludedDate}. Reason: ${exc.exclusionReason || 'not specified'}`,
          adverse: true,
        });
      }
    }

    return limitations;
  }

  buildReceiptPayload(normalized: Record<string, unknown>): Record<string, unknown> {
    return {
      source: this.sourceId,
      version: this.parserVersion,
      observedAt: (normalized as any).lastUpdated || null,
      claims: {
        exclusionCheck: 'performed',
        exclusionCount: normalized.exclusionCount || 0,
        hasActiveExclusion: ((normalized.exclusions as any[]) || []).some((e: any) => !e.reinstatedDate),
      },
    };
  }

  async healthcheck(): Promise<{ healthy: boolean; errorClass: ErrorClass | null; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${OIG_API}/0000000000`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      const latency = Date.now() - start;
      // OIG returns 200 with empty results for non-matching NPIs
      return { healthy: res.ok, errorClass: res.ok ? null : 'HTTP_5xx', latencyMs: latency };
    } catch {
      return { healthy: false, errorClass: 'NETWORK_ERROR', latencyMs: Date.now() - start };
    }
  }

  private hashRaw(raw: unknown): string {
    return sha256Sync(JSON.stringify(raw));
  }

  private buildErrorResult(npi: string, checkedAt: string, errorClass: ErrorClass, message: string): SourceCheckResult {
    return {
      sourceId: this.sourceId,
      laneType: this.laneType,
      status: SourceStatus.UNAVAILABLE,
      claims: [{ key: 'oig_exclusion_check', value: 'failed', present: false }],
      limitations: [{ code: 'FETCH_FAILED', description: `OIG check failed: ${message}`, adverse: false }],
      matchBasis: { mode: this.matchMode, confidence: 'unresolved', explanation: `OIG LEIE check could not be completed — cannot confirm clearance` },
      observedAt: null,
      checkedAt,
      rawHash: null,
      parserVersion: this.parserVersion,
      errorClass,
    };
  }
}
