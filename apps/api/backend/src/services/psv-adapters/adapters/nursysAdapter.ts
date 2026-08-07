/**
 * Wave 206 — Nursys e-Notify PSV Adapter
 * Extends BasePsvAdapter with Nursys-specific fetch + normalize.
 *
 * FAIL-CLOSED CONTRACT. This adapter previously did two unsafe things:
 *   1. It fetched the public Nursys verification page with no credentials.
 *   2. `normalize()` returned ACTIVE for any response that was not its own
 *      stub sentinel — so an HTML page, which fails JSON.parse and fell through
 *      as `{ raw: text }`, was reported as an ACTIVE license with an empty
 *      licence number. That status is mapped to `VERIFIED` in app.ts and
 *      counted toward `readinessScore` in psvOrchestrator.ts.
 *
 * Both are fixed here. Without configured credentials the adapter makes no
 * request at all, and no response shape can produce ACTIVE unless it carries an
 * explicit, recognized status field. Anything unrecognized is ERROR — never
 * NOT_FOUND, because "we could not read the source" is not "no licence exists".
 */
import { BasePsvAdapter } from '../baseAdapter';
import type { PsvAdapterConfig } from '../types';

type NormalizedResult = {
  normalizedData: Record<string, unknown>;
  status: 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
  licenseNumber?: string;
  state?: string;
  expiresAt?: string;
};

/** Statuses Nursys is known to return, mapped explicitly. Nothing is inferred. */
const STATUS_MAP: Record<string, 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND'> = {
  ACTIVE: 'ACTIVE',
  'ACTIVE IN RENEWAL': 'ACTIVE',
  EXPIRED: 'EXPIRED',
  LAPSED: 'EXPIRED',
  'NOT FOUND': 'NOT_FOUND',
};

export class NursysENotifyAdapter extends BasePsvAdapter {
  readonly config: PsvAdapterConfig = {
    sourceId: 'nursys',
    sourceDisplayName: 'Nursys e-Notify',
    methodologyVersion: '1.1.0',
    baseUrl: process.env.NURSYS_BASE_URL ?? 'https://www.nursys.com',
    timeout: 10_000,
    retryAttempts: 2,
  };

  // ETag cache keyed by NPI
  private etagCache = new Map<string, string>();

  supports(_npi: string): boolean { return true; }

  /**
   * Nursys is an institutional integration. Absent an executed agreement and
   * credentials there is no lawful automated route, so the adapter must not
   * call out at all.
   */
  private isConfigured(): boolean {
    return Boolean(
      process.env.NURSYS_BASE_URL &&
      process.env.NURSYS_CLIENT_ID &&
      process.env.NURSYS_CLIENT_SECRET,
    );
  }

  protected async doFetch(npi: string): Promise<{ rawResponse: unknown; sourceUrl: string; responseTimeMs: number }> {
    const sourceUrl = `${this.config.baseUrl}/NLV/NLVSearch.aspx?id=${npi}`;

    if (!this.isConfigured()) {
      // No request is made. Scraping the public verification surface without an
      // agreement is not a permitted route.
      return {
        rawResponse: { accessNotEstablished: true, npi, note: 'Nursys institutional credentials are not configured.' },
        sourceUrl,
        responseTimeMs: 0,
      };
    }

    const start = Date.now();
    const headers: Record<string, string> = { 'User-Agent': 'VitalCV/1.0', Accept: 'application/json' };
    const etag = this.etagCache.get(npi);
    if (etag) headers['If-None-Match'] = etag;

    try {
      const res = await fetch(sourceUrl, { headers, signal: AbortSignal.timeout(this.config.timeout) });
      if (res.status === 304) {
        return { rawResponse: { cached: true, npi }, sourceUrl, responseTimeMs: Date.now() - start };
      }
      if (!res.ok) {
        return {
          rawResponse: { sourceError: true, npi, httpStatus: res.status },
          sourceUrl,
          responseTimeMs: Date.now() - start,
        };
      }
      const newEtag = res.headers.get('etag');
      if (newEtag) this.etagCache.set(npi, newEtag);
      const text = await res.text();
      try {
        return { rawResponse: JSON.parse(text) as unknown, sourceUrl, responseTimeMs: Date.now() - start };
      } catch {
        // A non-JSON body (typically an HTML page) is not a licence record.
        return {
          rawResponse: { unparsed: true, npi, bodyPreview: text.slice(0, 200) },
          sourceUrl,
          responseTimeMs: Date.now() - start,
        };
      }
    } catch {
      return {
        rawResponse: { sourceError: true, npi, note: 'Nursys request failed.' },
        sourceUrl,
        responseTimeMs: Date.now() - start,
      };
    }
  }

  protected normalize(rawResponse: unknown): NormalizedResult {
    const r = (rawResponse ?? {}) as Record<string, unknown>;

    // Every non-answer is ERROR. None of these mean "no licence exists", and
    // none may contribute an ACTIVE artifact to a readiness score.
    if (r.accessNotEstablished || r.sourceError || r.unparsed || r.cached || r.stub) {
      return { normalizedData: r, status: 'ERROR' };
    }

    const rawStatus = r.licenseStatus ?? r.status ?? r.license_status;
    if (typeof rawStatus !== 'string') {
      return {
        normalizedData: { ...r, mappingError: 'No recognized status field in Nursys response.' },
        status: 'ERROR',
      };
    }

    const mapped = STATUS_MAP[rawStatus.trim().toUpperCase()];
    if (!mapped) {
      return {
        normalizedData: { ...r, mappingError: `Unrecognized Nursys status: ${rawStatus}` },
        status: 'ERROR',
      };
    }

    return {
      normalizedData: r,
      status: mapped,
      licenseNumber: typeof r.licenseNumber === 'string' ? r.licenseNumber
        : typeof r.license_number === 'string' ? r.license_number : undefined,
      state: typeof r.state === 'string' ? r.state
        : typeof r.jurisdiction === 'string' ? r.jurisdiction : undefined,
      expiresAt: typeof r.expirationDate === 'string' ? r.expirationDate
        : typeof r.expires_at === 'string' ? r.expires_at : undefined,
    };
  }
}
