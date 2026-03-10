import { BasePsvAdapter } from '../baseAdapter';
import type { PsvAdapterConfig } from '../types';

export class FsmbAdapter extends BasePsvAdapter {
  readonly config: PsvAdapterConfig = { sourceId: 'fsmb', sourceDisplayName: 'FSMB', methodologyVersion: '1.0.0', baseUrl: process.env.FSMB_API_URL ?? 'https://api.fsmb.org', timeout: 10_000, retryAttempts: 2 };
  supports(_npi: string): boolean { return true; }
  protected async doFetch(npi: string): Promise<{ rawResponse: unknown; sourceUrl: string; responseTimeMs: number }> {
    const key = process.env.FSMB_API_KEY;
    if (!key) return { rawResponse: { stub: true, npi, note: 'FSMB requires contracted API key' }, sourceUrl: this.config.baseUrl, responseTimeMs: 0 };
    const sourceUrl = `${this.config.baseUrl}/v1/physicians?npi=${npi}`;
    const start = Date.now();
    try {
      const res = await fetch(sourceUrl, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(this.config.timeout) });
      return { rawResponse: await res.json() as unknown, sourceUrl, responseTimeMs: Date.now() - start };
    } catch { return { rawResponse: { stub: true, npi }, sourceUrl, responseTimeMs: Date.now() - start }; }
  }
  protected normalize(r: unknown) {
    const rec = r as Record<string, unknown>;
    return { normalizedData: rec, status: rec.stub ? 'NOT_FOUND' as const : 'ACTIVE' as const, state: String(rec.state ?? ''), licenseNumber: String(rec.licenseNumber ?? '') };
  }
}
