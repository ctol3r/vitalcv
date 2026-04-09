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
      if (!res.ok) {
        throw new Error(`DCA API returned ${res.status}`);
      }
      const json = await res.json() as unknown;
      return { rawResponse: json, sourceUrl, responseTimeMs: Date.now() - start };
    } catch (err) {
      throw new Error(`Failed to fetch DCA BreEZe data: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  protected normalize(r: unknown) {
    const rec = r as Record<string, unknown>;
    const statusStr = String(rec.status ?? '').toUpperCase();
    let mappedStatus: 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR' = 'ERROR';
    if (statusStr.includes('ACTIVE') || statusStr.includes('CURRENT')) mappedStatus = 'ACTIVE';
    else if (statusStr.includes('EXPIRED') || statusStr.includes('INACTIVE')) mappedStatus = 'EXPIRED';
    else if (rec.error === 'NOT_FOUND') mappedStatus = 'NOT_FOUND';
    
    return {
      normalizedData: rec,
      status: mappedStatus,
      state: 'CA',
      licenseNumber: String(rec.licenseNumber ?? rec.license_number ?? ''),
      expiresAt: String(rec.expirationDate ?? ''),
    };
  }
}
