// ── OIG LEIE Source Adapter ───────────────────────────────────────
// Exclusion lane. NEVER defaults to "clear". Unresolved ≠ Clear.

import type { SourceAdapter, SourceCheckResult, SourceClaim, SourceLimitation, MatchResult, MatchConfidence, ErrorClass } from '../types';
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
    const matchBasis = this.deriveMatchBasis(normalized, npi);
    const status = this.classify(normalized, matchBasis.confidence);
    const claims = this.buildClaims(normalized, matchBasis.confidence);
    const limitations = this.buildLimitations(normalized, npi);

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

  /**
   * W1.2 — derive a match-confidence value that distinguishes the three
   * cases the audit found conflated:
   *
   *   no_match       — 0 records returned. ABSENCE of records — NOT a
   *                    guarantee of clearance. Adverse data takes 30 days
   *                    or more to land in LEIE; downstream copy must
   *                    treat this as "no records on file at check time".
   *
   *   possible_match — records returned BUT none with an exact NPI match.
   *                    The OIG endpoint is NPI-keyed, but legacy LEIE
   *                    entries can land without an NPI (filed pre-NPI,
   *                    or with name-only attribution). Returning records
   *                    without NPI is signal — needs a human reviewer
   *                    to reconcile whether the records describe the
   *                    queried subject. Maps to REVIEW_REQUIRED.
   *
   *   exact          — at least one returned record has e.npi === npi.
   *                    Severity then depends on `reinstatedDate` (handled
   *                    in classify): active exclusion → BLOCKED_SIGNAL,
   *                    fully reinstated → REVIEW_REQUIRED.
   */
  private deriveMatchBasis(normalized: Record<string, unknown>, queriedNpi: string): MatchResult {
    const exclusions = (normalized.exclusions as any[]) ?? [];
    const exclusionCount = exclusions.length;
    const exactNpiMatches = exclusions.filter(
      (e: any) => typeof e?.npi === 'string' && e.npi === queriedNpi,
    ).length;
    const ambiguousMatches = exclusionCount - exactNpiMatches;

    if (exclusionCount === 0) {
      return {
        mode: this.matchMode,
        confidence: 'no_match',
        explanation:
          `OIG LEIE returned 0 records for NPI ${queriedNpi}. ` +
          `Absence of records on file at check time — not a guarantee of clearance.`,
      };
    }

    if (exactNpiMatches > 0) {
      return {
        mode: this.matchMode,
        confidence: 'exact',
        explanation:
          `OIG LEIE returned ${exactNpiMatches} NPI-exact record(s) for NPI ${queriedNpi}` +
          (ambiguousMatches > 0
            ? ` (plus ${ambiguousMatches} additional record(s) without an exact NPI match).`
            : '.'),
      };
    }

    return {
      mode: this.matchMode,
      confidence: 'possible_match',
      explanation:
        `OIG LEIE returned ${ambiguousMatches} record(s) for NPI ${queriedNpi} ` +
        `but none with an exact NPI match. Possible name-only match — review required.`,
    };
  }

  classify(
    normalized: Record<string, unknown>,
    matchConfidence: MatchConfidence = 'exact',
  ): SourceStatus {
    const count = normalized.exclusionCount as number || 0;

    // W1.2 — possible_match (records present but no exact NPI match) is a
    // human-review signal, NOT a blocker. It must not flip to BLOCKED_SIGNAL
    // because false-positive name matches in LEIE are a known limitation
    // (see SOURCE_REGISTRY entry: 'Name variations may miss matches').
    if (matchConfidence === 'possible_match') {
      return SourceStatus.REVIEW_REQUIRED;
    }

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

    // W1.2 — 0 records is `no_match` confidence (not `exact`). The
    // SourceStatus stays CHECKED (the check completed) but the matchBasis
    // confidence is what downstream surfaces should consult to render
    // language. Never imply authoritative clearance from a `no_match`.
    return SourceStatus.CHECKED;
  }

  buildClaims(
    normalized: Record<string, unknown>,
    matchConfidence: MatchConfidence = 'exact',
  ): SourceClaim[] {
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
      // W1.2 — explicit match-confidence claim so downstream consumers
      // can reason about it without re-deriving from the explanation.
      {
        key: 'oig_match_confidence',
        value: matchConfidence,
        present: true,
      },
      {
        key: 'exclusions',
        value: exclusions,
        present: exclusions.length > 0,
      },
    ];
  }

  buildLimitations(
    normalized: Record<string, unknown>,
    queriedNpi?: string,
  ): SourceLimitation[] {
    const exclusions = (normalized.exclusions as any[]) || [];
    const limitations: SourceLimitation[] = [];

    for (const exc of exclusions) {
      // W1.2 — distinguish a name-only / no-NPI record from an NPI-exact
      // exclusion. The former needs human reconciliation; the latter is
      // an authoritative match (and may be active or reinstated).
      const isNpiExact =
        typeof queriedNpi === 'string' &&
        typeof exc?.npi === 'string' &&
        exc.npi === queriedNpi;

      if (!isNpiExact) {
        limitations.push({
          code: 'OIG_POSSIBLE_NAME_MATCH',
          description:
            `Record returned without an exact NPI match` +
            (exc.name ? ` (name: ${exc.name})` : '') +
            `. Possible false-positive — review required before treating as adverse.`,
          // Not adverse on its own — a human must reconcile.
          adverse: false,
        });
        continue;
      }

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
