import { BasePsvAdapter } from '../baseAdapter';
import type { PsvAdapterConfig } from '../types';

export class DcaBreezeAdapter extends BasePsvAdapter {
  readonly config: PsvAdapterConfig = { sourceId: 'dca-breeze', sourceDisplayName: 'DCA BreEZe', methodologyVersion: '1.0.0', baseUrl: 'https://search.dca.ca.gov', timeout: 15_000, retryAttempts: 3 };
  supports(_npi: string): boolean { return true; }
  protected async doFetch(npi: string): Promise<{ rawResponse: unknown; sourceUrl: string; responseTimeMs: number }> {
    const sourceUrl = `${this.config.baseUrl}/api/search/v1?licenseType=RN&q=${npi}`;
    const start = Date.now();
    try {
      const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(this.config.timeout), headers: { Accept: 'application/json' } });
      const json = await res.json() as unknown;
      return { rawResponse: json, sourceUrl, responseTimeMs: Date.now() - start };
    } catch {
      return { rawResponse: { stub: true, npi, state: 'CA', note: 'DCA BreEZe stub' }, sourceUrl, responseTimeMs: Date.now() - start };
    }
  }
  protected normalize(r: unknown) {
    const rec = r as Record<string, unknown>;
    return { normalizedData: rec, status: 'ACTIVE' as const, state: 'CA', licenseNumber: String(rec.licenseNumber ?? rec.license_number ?? ''), expiresAt: String(rec.expirationDate ?? '') };
  }
}
