// ── NPPES Source Adapter ──────────────────────────────────────────
// Identity core. The foundational source — all other sources key off this.

import type { SourceAdapter, SourceCheckResult, SourceClaim, SourceLimitation, MatchResult, ErrorClass } from '../types';
import { SourceStatus } from '../types';
import { sha256Sync } from '../utils/hash';

const NPPES_API = 'https://npiregistry.cms.hhs.gov/api/';

export class NppesAdapter implements SourceAdapter {
  readonly sourceId = 'NPPES';
  readonly laneType = 'identity' as const;
  readonly cadence = 24 * 60 * 60 * 1000;
  readonly freshnessTtl = 7 * 24 * 60 * 60 * 1000;
  readonly authMode = 'none' as const;
  readonly matchMode = 'npi_exact' as const;
  readonly parserVersion = 'nppes-v2';

  async fetch(npi: string): Promise<SourceCheckResult> {
    const checkedAt = new Date().toISOString();
    let raw: unknown;
    let errorClass: ErrorClass | null = null;

    try {
      const url = `${NPPES_API}?version=2.1&number=${encodeURIComponent(npi)}`;
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

    const matchBasis: MatchResult = {
      mode: this.matchMode,
      confidence: ((normalized as any).basic)?.number === npi ? 'exact' : 'no_match',
      explanation: ((normalized as any).basic)?.number === npi
        ? `NPI ${npi} matched exactly in NPPES registry`
        : `NPI ${npi} not found in NPPES response`,
    };

    return {
      sourceId: this.sourceId,
      laneType: this.laneType,
      status,
      claims,
      limitations,
      matchBasis,
      observedAt: (normalized as any).basic?.lastUpdated || null,
      checkedAt,
      rawHash,
      parserVersion: this.parserVersion,
      errorClass: null,
    };
  }

  normalize(raw: unknown): Record<string, unknown> {
    const data = (raw as any)?.results?.[0];
    if (!data) return { basic: null, taxonomy: [], addresses: [], identifiers: [] };

    const basic = {
      number: data.number || null,
      entityType: data.enumeration_type || null,
      firstName: data.basic?.first_name || null,
      lastName: data.basic?.last_name || null,
      credentialedName: data.basic?.name || null,
      status: data.basic?.status || null,
      lastUpdated: data.basic?.last_updated || null,
      enumerationDate: data.basic?.enumeration_date || null,
    };

    const taxonomy = (data.taxonomies || []).map((t: any) => ({
      code: t.code || null,
      desc: t.desc || null,
      primary: t.primary === true,
      state: t.state || null,
      license: t.license || null,
    }));

    const addresses = (data.addresses || []).map((a: any) => ({
      line1: a.address_1 || null,
      line2: a.address_2 || null,
      city: a.city || null,
      state: a.state || null,
      postalCode: a.postal_code || null,
      country: a.country_code || null,
      type: a.address_purpose || null,
      telephone: a.telephone_number || null,
      fax: a.fax_number || null,
    }));

    const identifiers = (data.identifiers || []).map((i: any) => ({
      code: i.code || null,
      desc: i.desc || null,
      issuer: i.issuer || null,
      state: i.state || null,
    }));

    return { basic, taxonomy, addresses, identifiers };
  }

  classify(normalized: Record<string, unknown>): SourceStatus {
    const basic = ((normalized as any).basic) as Record<string, unknown> | null;
    if (!basic || !basic.number) return SourceStatus.UNAVAILABLE;
    if (basic.status === 'A' || basic.status === 'Active') return SourceStatus.CHECKED;
    // Status D = deactivated, I = inactive
    if (basic.status === 'D' || basic.status === 'I') {
      return SourceStatus.REVIEW_REQUIRED; // Not a blocker, but needs attention
    }
    return SourceStatus.REVIEW_REQUIRED;
  }

  buildClaims(normalized: Record<string, unknown>): SourceClaim[] {
    const basic = ((normalized as any).basic) as Record<string, unknown> | null;
    if (!basic) return [];

    return [
      { key: 'npi', value: basic.number, present: !!basic.number },
      { key: 'entity_type', value: basic.entityType, present: !!basic.entityType },
      { key: 'first_name', value: basic.firstName, present: !!basic.firstName },
      { key: 'last_name', value: basic.lastName, present: !!basic.lastName },
      { key: 'credentialed_name', value: basic.credentialedName, present: !!basic.credentialedName },
      { key: 'active_status', value: basic.status === 'A' || basic.status === 'Active', present: !!basic.status },
      { key: 'enumeration_date', value: basic.enumerationDate, present: !!basic.enumerationDate },
      { key: 'last_updated', value: basic.lastUpdated, present: !!basic.lastUpdated },
      { key: 'taxonomy', value: (normalized.taxonomy as any[]) || [], present: (normalized.taxonomy as any[])?.length > 0 },
      { key: 'address', value: (normalized.addresses as any[]) || [], present: (normalized.addresses as any[])?.length > 0 },
      { key: 'identifiers', value: (normalized.identifiers as any[]) || [], present: (normalized.identifiers as any[])?.length > 0 },
    ];
  }

  buildLimitations(normalized: Record<string, unknown>): SourceLimitation[] {
    const basic = ((normalized as any).basic) as Record<string, unknown> | null;
    const limitations: SourceLimitation[] = [];

    if (!basic || !basic.number) {
      limitations.push({ code: 'NPI_NOT_FOUND', description: 'NPI not found in NPPES registry', adverse: false });
      return limitations;
    }

    if (basic.status !== 'A' && basic.status !== 'Active') {
      limitations.push({
        code: 'NPI_NOT_ACTIVE',
        description: `NPI status is "${basic.status}" — not Active`,
        adverse: false,
      });
    }

    if (!(normalized.taxonomy as any[])?.length) {
      limitations.push({ code: 'NO_TAXONOMY', description: 'No taxonomy codes on file', adverse: false });
    }

    return limitations;
  }

  buildReceiptPayload(normalized: Record<string, unknown>): Record<string, unknown> {
    return {
      source: this.sourceId,
      version: this.parserVersion,
      observedAt: (((normalized as any).basic) as any)?.lastUpdated || null,
      claims: {
        npi: (((normalized as any).basic) as any)?.number,
        entityType: (((normalized as any).basic) as any)?.entityType,
        name: (((normalized as any).basic) as any)?.credentialedName,
        status: (((normalized as any).basic) as any)?.status,
        enumerationDate: (((normalized as any).basic) as any)?.enumerationDate,
      },
    };
  }

  async healthcheck(): Promise<{ healthy: boolean; errorClass: ErrorClass | null; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${NPPES_API}?version=2.1&number=1234567890`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      const latency = Date.now() - start;
      // 200 with empty results = healthy
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
      claims: [],
      limitations: [{ code: 'FETCH_FAILED', description: message, adverse: false }],
      matchBasis: { mode: this.matchMode, confidence: 'unresolved', explanation: `NPPES check failed: ${message}` },
      observedAt: null,
      checkedAt,
      rawHash: null,
      parserVersion: this.parserVersion,
      errorClass,
    };
  }
}
