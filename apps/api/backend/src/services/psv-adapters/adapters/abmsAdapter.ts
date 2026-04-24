import { BasePsvAdapter } from '../baseAdapter';
import type { PsvAdapterConfig } from '../types';

/**
 * ABMS (American Board of Medical Specialties) Certification Adapter
 *
 * ABMS has no public API. Institutional access requires a signed ABMS Data
 * Services agreement. This adapter is gated by ABMS_API_KEY; when the key
 * is absent it returns a stub NOT_FOUND result so the readiness engine
 * treats the source as pending rather than erroring.
 */
export class AbmsAdapter extends BasePsvAdapter {
  readonly config: PsvAdapterConfig = {
    sourceId: 'ABMS_SPINE',
    sourceDisplayName: 'ABMS Board Certification',
    methodologyVersion: '1.0.0',
    baseUrl: 'https://certification.abms.org',
    apiKey: process.env.ABMS_API_KEY,
    timeout: 15_000,
    retryAttempts: 2,
  };

  supports(_npi: string): boolean {
    return true;
  }

  protected async doFetch(npi: string): Promise<{ rawResponse: unknown; sourceUrl: string; responseTimeMs: number }> {
    const apiKey = this.config.apiKey;
    const sourceUrl = `${this.config.baseUrl}/api/v1/certification?npi=${npi}`;
    const start = Date.now();

    if (!apiKey) {
      return {
        rawResponse: { stub: true, npi, reason: 'ABMS_API_KEY not configured' },
        sourceUrl,
        responseTimeMs: 0,
      };
    }

    const res = await fetch(sourceUrl, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!res.ok) {
      throw new Error(`ABMS API returned ${res.status}`);
    }

    return {
      rawResponse: await res.json() as unknown,
      sourceUrl,
      responseTimeMs: Date.now() - start,
    };
  }

  protected normalize(rawResponse: unknown): {
    normalizedData: Record<string, unknown>;
    status: 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
    licenseNumber?: string;
    state?: string;
    expiresAt?: string;
  } {
    const r = rawResponse as Record<string, unknown>;

    if (r.stub) {
      return { normalizedData: r, status: 'NOT_FOUND' };
    }

    const certStatus = String(r.certificationStatus ?? r.status ?? '').toUpperCase();
    let status: 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR' = 'NOT_FOUND';
    if (certStatus.includes('CERTIFIED') || certStatus === 'ACTIVE') {
      status = 'ACTIVE';
    } else if (certStatus.includes('EXPIRED') || certStatus === 'LAPSED') {
      status = 'EXPIRED';
    }

    return {
      normalizedData: r,
      status,
      licenseNumber: String(r.certificationId ?? r.certificate_number ?? ''),
      expiresAt: String(r.expirationDate ?? r.expires_at ?? ''),
    };
  }
}
