import { randomUUID } from 'node:crypto';

import { log } from '../../obs/logger';
import { sha256Hex, stableStringify } from '../../utils/deterministic';
import type { IPsvAdapter, PsvAdapterConfig, PsvArtifact } from './types';

type FetchResult = {
  rawResponse: unknown;
  sourceUrl: string;
  responseTimeMs: number;
};

type NormalizedResult = {
  normalizedData: Record<string, unknown>;
  status: PsvArtifact['status'];
  licenseNumber?: string;
  state?: string;
  expiresAt?: string;
};

const DEFAULT_VERIFIER_IDENTITY = 'vitalcv-psv-v1';
const BASE_BACKOFF_MS = 250;

export abstract class BasePsvAdapter implements IPsvAdapter {
  public abstract readonly config: PsvAdapterConfig;

  protected abstract doFetch(
    npi: string,
    opts?: Record<string, unknown>,
  ): Promise<FetchResult>;

  protected abstract normalize(rawResponse: unknown): NormalizedResult;

  public abstract supports(npi: string): boolean;

  public async fetchArtifact(
    npi: string,
    opts: Record<string, unknown> = {},
  ): Promise<PsvArtifact> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await this.doFetch(npi, { ...opts, signal: controller.signal });
        clearTimeout(timeoutHandle);

        const retrievalTimestampUtc = new Date().toISOString();
        const rawPayload = stableStringify(response.rawResponse);
        const checksum = sha256Hex(rawPayload);

        try {
          const normalized = this.normalize(response.rawResponse);

          return {
            artifactId: randomUUID(),
            npi,
            source: this.config.sourceId,
            sourceUrl: response.sourceUrl,
            endpointMetadata: {
              version: this.config.methodologyVersion,
              retrievedAt: retrievalTimestampUtc,
              responseTimeMs: response.responseTimeMs,
            },
            retrievalTimestampUtc,
            rawPayload,
            checksum,
            rawChecksum: checksum,
            normalizedData: normalized.normalizedData,
            methodologyVersion: this.config.methodologyVersion,
            verifierIdentity: DEFAULT_VERIFIER_IDENTITY,
            status: normalized.status,
            licenseNumber: normalized.licenseNumber,
            state: normalized.state,
            expiresAt: normalized.expiresAt,
          };
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Normalization failed';

          log('warn', 'psv_adapter_normalize_failed', {
            source: this.config.sourceId,
            npi,
            error: detail,
          });

          return {
            artifactId: randomUUID(),
            npi,
            source: this.config.sourceId,
            sourceUrl: response.sourceUrl,
            endpointMetadata: {
              version: this.config.methodologyVersion,
              retrievedAt: retrievalTimestampUtc,
              responseTimeMs: response.responseTimeMs,
            },
            retrievalTimestampUtc,
            rawPayload,
            checksum,
            rawChecksum: checksum,
            normalizedData: { error: detail },
            methodologyVersion: this.config.methodologyVersion,
            verifierIdentity: DEFAULT_VERIFIER_IDENTITY,
            status: 'ERROR',
          };
        }
      } catch (error) {
        clearTimeout(timeoutHandle);
        lastError = error instanceof Error ? error : new Error(String(error));

        log('warn', 'psv_adapter_fetch_failed', {
          source: this.config.sourceId,
          npi,
          attempt: attempt + 1,
          retries: this.config.retryAttempts,
          error: lastError.message,
        });

        if (attempt < this.config.retryAttempts) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
        }
      }
    }

    return this.buildErrorArtifact(npi, lastError);
  }

  protected getAbortSignal(opts?: Record<string, unknown>): AbortSignal | undefined {
    const maybeSignal = opts?.signal;
    if (maybeSignal && typeof maybeSignal === 'object' && 'aborted' in maybeSignal) {
      return maybeSignal as AbortSignal;
    }
    return undefined;
  }

  protected coerceStatus(input: unknown): PsvArtifact['status'] {
    const normalized = String(input ?? '').trim().toUpperCase();

    if (!normalized) {
      return 'ERROR';
    }

    if (['ACTIVE', 'APPROVED', 'CURRENT', 'CLEAR', 'VALID'].includes(normalized)) {
      return 'ACTIVE';
    }

    if (['EXPIRED', 'INACTIVE', 'LAPSED'].includes(normalized)) {
      return 'EXPIRED';
    }

    if (['NOT_FOUND', 'NONE', 'UNKNOWN', 'MISSING'].includes(normalized)) {
      return 'NOT_FOUND';
    }

    return 'ERROR';
  }

  protected isValidNpi(npi: string): boolean {
    return /^\d{10}$/.test(npi);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildErrorArtifact(npi: string, error: Error | null): PsvArtifact {
    const retrievalTimestampUtc = new Date().toISOString();
    const rawResponse = {
      source: this.config.sourceId,
      npi,
      error: error?.message ?? 'Unknown fetch error',
      retrievedAt: retrievalTimestampUtc,
    };
    const rawPayload = stableStringify(rawResponse);
    const checksum = sha256Hex(rawPayload);

    return {
      artifactId: randomUUID(),
      npi,
      source: this.config.sourceId,
      sourceUrl: this.config.baseUrl,
      endpointMetadata: {
        version: this.config.methodologyVersion,
        retrievedAt: retrievalTimestampUtc,
        responseTimeMs: 0,
      },
      retrievalTimestampUtc,
      rawPayload,
      checksum,
      rawChecksum: checksum,
      normalizedData: {
        error: error?.message ?? 'Unknown fetch error',
        sourceDisplayName: this.config.sourceDisplayName,
      },
      methodologyVersion: this.config.methodologyVersion,
      verifierIdentity: DEFAULT_VERIFIER_IDENTITY,
      status: 'ERROR',
    };
  }
}
