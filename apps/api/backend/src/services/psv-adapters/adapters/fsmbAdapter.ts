/**
 * FSMB PSV Adapter.
 *
 * FAIL-CLOSED CONTRACT. `normalize()` previously returned ACTIVE for any
 * response that was not its own stub sentinel — including an FSMB error body,
 * an empty result, or a rate-limit payload. That status is mapped to `VERIFIED`
 * in app.ts and counted toward `readinessScore` in psvOrchestrator.ts, so an
 * unrecognized response could present as a verified licence.
 *
 * Now: only an explicit, recognized status field can produce ACTIVE or EXPIRED.
 * Everything else is ERROR — never NOT_FOUND, because failing to read a source
 * is not evidence that no licence exists.
 *
 * Note this adapter targets a generic `api.fsmb.org` shape. The real FSMB
 * Physician Data Center integration is contract-gated and modelled separately
 * in `@vitalcv/licensure` (FsmbPdcAdapter), which stays closed until an
 * institutional agreement and a validated response mapping exist.
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

const STATUS_MAP: Record<string, 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND'> = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  LAPSED: 'EXPIRED',
  'NOT FOUND': 'NOT_FOUND',
};

export class FsmbAdapter extends BasePsvAdapter {
  readonly config: PsvAdapterConfig = {
    sourceId: 'fsmb',
    sourceDisplayName: 'FSMB',
    methodologyVersion: '1.1.0',
    baseUrl: process.env.FSMB_API_URL ?? 'https://api.fsmb.org',
    timeout: 10_000,
    retryAttempts: 2,
  };

  supports(_npi: string): boolean { return true; }

  protected async doFetch(npi: string): Promise<{ rawResponse: unknown; sourceUrl: string; responseTimeMs: number }> {
    const key = process.env.FSMB_API_KEY;
    if (!key) {
      return {
        rawResponse: { accessNotEstablished: true, npi, note: 'FSMB requires a contracted API key.' },
        sourceUrl: this.config.baseUrl,
        responseTimeMs: 0,
      };
    }

    const sourceUrl = `${this.config.baseUrl}/v1/physicians?npi=${npi}`;
    const start = Date.now();
    try {
      const res = await fetch(sourceUrl, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.timeout),
      });
      if (!res.ok) {
        return {
          rawResponse: { sourceError: true, npi, httpStatus: res.status },
          sourceUrl,
          responseTimeMs: Date.now() - start,
        };
      }
      return { rawResponse: await res.json() as unknown, sourceUrl, responseTimeMs: Date.now() - start };
    } catch {
      return {
        rawResponse: { sourceError: true, npi, note: 'FSMB request failed.' },
        sourceUrl,
        responseTimeMs: Date.now() - start,
      };
    }
  }

  protected normalize(r: unknown): NormalizedResult {
    const rec = (r ?? {}) as Record<string, unknown>;

    if (rec.accessNotEstablished || rec.sourceError || rec.stub) {
      return { normalizedData: rec, status: 'ERROR' };
    }

    const rawStatus = rec.licenseStatus ?? rec.status ?? rec.license_status;
    if (typeof rawStatus !== 'string') {
      return {
        normalizedData: { ...rec, mappingError: 'No recognized status field in FSMB response.' },
        status: 'ERROR',
      };
    }

    const mapped = STATUS_MAP[rawStatus.trim().toUpperCase()];
    if (!mapped) {
      return {
        normalizedData: { ...rec, mappingError: `Unrecognized FSMB status: ${rawStatus}` },
        status: 'ERROR',
      };
    }

    return {
      normalizedData: rec,
      status: mapped,
      state: typeof rec.state === 'string' ? rec.state : undefined,
      licenseNumber: typeof rec.licenseNumber === 'string' ? rec.licenseNumber : undefined,
    };
  }
}
