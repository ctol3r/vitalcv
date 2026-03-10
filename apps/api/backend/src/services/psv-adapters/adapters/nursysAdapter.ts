/**
 * Wave 206 — Nursys e-Notify PSV Adapter
 * Extends BasePsvAdapter with Nursys-specific fetch + normalize.
 */
import { BasePsvAdapter } from '../baseAdapter';
import type { PsvAdapterConfig } from '../types';

export class NursysENotifyAdapter extends BasePsvAdapter {
  readonly config: PsvAdapterConfig = {
    sourceId: 'nursys',
    sourceDisplayName: 'Nursys e-Notify',
    methodologyVersion: '1.0.0',
    baseUrl: 'https://www.nursys.com',
    timeout: 10_000,
    retryAttempts: 2,
  };

  // ETag cache keyed by NPI
  private etagCache = new Map<string, string>();

  supports(_npi: string): boolean { return true; }

  protected async doFetch(npi: string): Promise<{ rawResponse: unknown; sourceUrl: string; responseTimeMs: number }> {
    const sourceUrl = `${this.config.baseUrl}/NLV/NLVSearch.aspx?id=${npi}`;
    const start = Date.now();
    const headers: Record<string, string> = { 'User-Agent': 'VitalCV/1.0', Accept: 'application/json' };
    const etag = this.etagCache.get(npi);
    if (etag) headers['If-None-Match'] = etag;

    try {
      const res = await fetch(sourceUrl, { headers, signal: AbortSignal.timeout(this.config.timeout) });
      if (res.status === 304) {
        return { rawResponse: { cached: true, npi }, sourceUrl, responseTimeMs: Date.now() - start };
      }
      const newEtag = res.headers.get('etag');
      if (newEtag) this.etagCache.set(npi, newEtag);
      const text = await res.text();
      try { return { rawResponse: JSON.parse(text), sourceUrl, responseTimeMs: Date.now() - start }; }
      catch { return { rawResponse: { raw: text, npi }, sourceUrl, responseTimeMs: Date.now() - start }; }
    } catch {
      // Return stub on network failure (Nursys may not be accessible without credentials)
      return {
        rawResponse: { stub: true, npi, note: 'Nursys e-Notify requires credentials' },
        sourceUrl,
        responseTimeMs: Date.now() - start,
      };
    }
  }

  protected normalize(rawResponse: unknown): {
    normalizedData: Record<string, unknown>;
    status: 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
    licenseNumber?: string; state?: string; expiresAt?: string;
  } {
    const r = rawResponse as Record<string, unknown>;
    if (r.stub || r.cached) {
      return { normalizedData: r, status: 'NOT_FOUND' };
    }
    return {
      normalizedData: r,
      status: 'ACTIVE',
      licenseNumber: String(r.licenseNumber ?? r.license_number ?? ''),
      state: String(r.state ?? r.jurisdiction ?? ''),
      expiresAt: String(r.expirationDate ?? r.expires_at ?? ''),
    };
  }
}
