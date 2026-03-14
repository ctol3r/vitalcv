/**
 * Benchmark profile:
 * - cache hit: <1ms per source
 * - NPPES live: ~200-900ms
 * - OIG LEIE live/stub: ~100-700ms
 * - Nursys stub/live probe: ~50-300ms
 * - DEA via NPPES: ~200-900ms
 * - State board connector: ~50-600ms
 *
 * Parallel fanout plus cache-first reads is designed to keep full multi-source
 * verification under the 3s p95 target when slow sources are bounded.
 */

import { randomUUID } from 'node:crypto';
import { AdapterRegistry } from '../../../adapters/AdapterRegistry';
import { DeaAdapter } from '../../../adapters/DeaAdapter';
import { NppesAdapter } from '../../../adapters/NppesAdapter';
import { NursysAdapter } from '../../../adapters/NursysAdapter';
import { OigLeieAdapter } from '../../../adapters/OigLeieAdapter';
import { StateBoardAdapter } from '../../../adapters/StateBoardAdapter';
import type { NormalizedCredentialPayload, PsvAdapter } from '../../../adapters/types';
import type { CredentialType } from '../../../types/psv';
import { log } from '../../obs/logger';
import {
  getPsvCacheInstance,
  type PsvSourceName,
  type PsvVerificationCache,
} from './PsvVerificationCache';

export interface PsvVerifyRequest {
  npi: string;
  credentialType?: CredentialType;
  state?: string;
  licenseNumber?: string;
  bypassCache?: boolean;
}

export interface PsvSourceResult {
  source: string;
  status: 'verified' | 'unverified' | 'error' | 'cached' | 'stub';
  payload: NormalizedCredentialPayload | null;
  latencyMs: number;
  cachedAt?: string;
  error?: string;
}

export interface PsvVerifyResponse {
  npi: string;
  requestId: string;
  completedAt: string;
  totalLatencyMs: number;
  sources: PsvSourceResult[];
  overallStatus: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'ERROR';
  exclusionClear: boolean;
  exclusionSource: 'live' | 'stub' | 'cached';
}

type AdapterExecutionPlan = {
  adapter: PsvAdapter;
  cacheSource: PsvSourceName;
  credentialType: CredentialType;
};

type AdapterExecutionSuccess = {
  payload: NormalizedCredentialPayload;
  latencyMs: number;
};

type AdapterExecutionFailure = {
  error: unknown;
  latencyMs: number;
};

type RegistryShape = {
  adapters?: PsvAdapter[];
};

function listRegisteredAdapters(registry: AdapterRegistry): PsvAdapter[] {
  return [...(((registry as unknown as RegistryShape).adapters) ?? [])];
}

function roundLatency(ms: number): number {
  return Number(ms.toFixed(2));
}

function resolveCacheSource(adapterName: string): PsvSourceName {
  switch (adapterName) {
    case 'NPPES':
    case 'OIG_LEIE':
    case 'NURSYS':
    case 'STATE_BOARD':
    case 'DEA':
      return adapterName;
    default:
      throw new Error(`Unsupported PSV adapter: ${adapterName}`);
  }
}

function classifyPayload(
  payload: NormalizedCredentialPayload,
): PsvSourceResult['status'] {
  if (payload.credential.status === 'Active') {
    return 'verified';
  }

  if (payload.credential.status === 'Unknown') {
    return 'stub';
  }

  return 'unverified';
}

function isVerifiedPayload(payload: NormalizedCredentialPayload | null): boolean {
  return payload?.credential.status === 'Active';
}

function normalizeCredentialType(
  payload: NormalizedCredentialPayload,
  credentialType: CredentialType,
): NormalizedCredentialPayload {
  if (payload.credential.credentialType === credentialType) {
    return payload;
  }

  return {
    ...payload,
    credential: {
      ...payload.credential,
      credentialType,
    },
  };
}

function getSourceName(
  payload: NormalizedCredentialPayload | null,
  fallback: string,
): string {
  return payload?.source.sourceName || fallback;
}

function getRawMode(payload: NormalizedCredentialPayload | null): string | null {
  const rawPayload = payload?.retrieval.rawPayload;

  if (!rawPayload || typeof rawPayload !== 'object' || !('mode' in rawPayload)) {
    return null;
  }

  const mode = rawPayload.mode;
  return typeof mode === 'string' ? mode : null;
}

function isExecutionFailure(value: unknown): value is AdapterExecutionFailure {
  return typeof value === 'object' && value !== null && 'latencyMs' in value && 'error' in value;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function determineOverallStatus(
  sources: PsvSourceResult[],
): PsvVerifyResponse['overallStatus'] {
  if (sources.length === 0) {
    return 'ERROR';
  }

  const errorCount = sources.filter((source) => source.status === 'error').length;
  const verifiedCount = sources.filter((source) => isVerifiedPayload(source.payload)).length;

  if (verifiedCount === sources.length) {
    return 'VERIFIED';
  }

  if (verifiedCount > 0) {
    return 'PARTIAL';
  }

  if (errorCount === sources.length) {
    return 'ERROR';
  }

  return 'UNVERIFIED';
}

function determineExclusion(
  sources: PsvSourceResult[],
): Pick<PsvVerifyResponse, 'exclusionClear' | 'exclusionSource'> {
  const exclusionResult = sources.find(
    (source) =>
      source.source === 'OIG_LEIE' || source.payload?.source.sourceName === 'OIG_LEIE',
  );

  if (!exclusionResult || !exclusionResult.payload) {
    return {
      exclusionClear: false,
      exclusionSource: 'stub',
    };
  }

  if (exclusionResult.status === 'cached') {
    return {
      exclusionClear: exclusionResult.payload.credential.status === 'Active',
      exclusionSource: 'cached',
    };
  }

  const mode = getRawMode(exclusionResult.payload);

  return {
    exclusionClear: exclusionResult.payload.credential.status === 'Active',
    exclusionSource:
      mode && mode.startsWith('live')
        ? 'live'
        : process.env.OIG_LEIE_ENABLED === 'true'
          ? 'live'
          : 'stub',
  };
}

export class PsvOrchestrator {
  constructor(
    private readonly registry: AdapterRegistry,
    private readonly cache: PsvVerificationCache,
  ) {}

  async verify(req: PsvVerifyRequest): Promise<PsvVerifyResponse> {
    const requestId = randomUUID();
    const startedAt = process.hrtime.bigint();
    const plans = this.selectAdapters(req.credentialType);
    const sourceResults: Array<PsvSourceResult | undefined> = new Array(plans.length);
    const livePlans: Array<{ index: number; key: string; plan: AdapterExecutionPlan }> = [];

    for (const [index, plan] of plans.entries()) {
      const key = `${req.npi}:${plan.cacheSource}:${plan.credentialType}`;

      if (!req.bypassCache) {
        const cachedEntry = this.cache.get(key);

        if (cachedEntry) {
          sourceResults[index] = {
            source: getSourceName(cachedEntry.payload, plan.adapter.adapterName),
            status: 'cached',
            payload: cachedEntry.payload,
            latencyMs: 0,
            cachedAt: cachedEntry.fetchedAt,
          };
          continue;
        }
      }

      livePlans.push({ index, key, plan });
    }

    const settledResults = await Promise.allSettled(
      livePlans.map(({ plan }) => this.executePlan(plan, req)),
    );

    settledResults.forEach((result, settledIndex) => {
      const { index, key, plan } = livePlans[settledIndex];

      if (result.status === 'fulfilled') {
        const liveResult = result.value;
        sourceResults[index] = {
          source: getSourceName(liveResult.payload, plan.adapter.adapterName),
          status: classifyPayload(liveResult.payload),
          payload: liveResult.payload,
          latencyMs: liveResult.latencyMs,
        };
        this.cache.set(
          key,
          this.cache.createEntry({
            npi: req.npi,
            source: plan.cacheSource,
            credentialType: plan.credentialType,
            payload: liveResult.payload,
          }),
        );
        return;
      }

      const failure = isExecutionFailure(result.reason)
        ? result.reason
        : { error: result.reason, latencyMs: 0 };

      sourceResults[index] = {
        source: plan.adapter.adapterName,
        status: 'error',
        payload: null,
        latencyMs: failure.latencyMs,
        error: getErrorMessage(failure.error),
      };
    });

    const completedAt = new Date().toISOString();
    const sources = sourceResults.filter(
      (source): source is PsvSourceResult => source !== undefined,
    );
    const totalLatencyMs = roundLatency(
      Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    );
    const overallStatus = determineOverallStatus(sources);
    const exclusion = determineExclusion(sources);

    log('info', 'psv_orchestrator_complete', {
      npi: req.npi,
      requestId,
      totalLatencyMs,
      overallStatus,
    });

    return {
      npi: req.npi,
      requestId,
      completedAt,
      totalLatencyMs,
      sources,
      overallStatus,
      exclusionClear: exclusion.exclusionClear,
      exclusionSource: exclusion.exclusionSource,
    };
  }

  private selectAdapters(credentialType?: CredentialType): AdapterExecutionPlan[] {
    const adapters = listRegisteredAdapters(this.registry);
    const selectedAdapters = credentialType
      ? adapters.filter((adapter) =>
          adapter.supportedCredentialTypes.includes(credentialType),
        )
      : adapters;

    return selectedAdapters.map((adapter) => ({
      adapter,
      cacheSource: resolveCacheSource(adapter.adapterName),
      credentialType:
        credentialType && adapter.supportedCredentialTypes.includes(credentialType)
          ? credentialType
          : adapter.supportedCredentialTypes[0],
    }));
  }

  private async executePlan(
    plan: AdapterExecutionPlan,
    req: PsvVerifyRequest,
  ): Promise<AdapterExecutionSuccess> {
    const startedAt = process.hrtime.bigint();

    try {
      const payload = await plan.adapter.verify({
        npi: req.npi,
        state: req.state,
        licenseNumber: req.licenseNumber,
      });

      return {
        payload: normalizeCredentialType(payload, plan.credentialType),
        latencyMs: roundLatency(
          Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        ),
      };
    } catch (error) {
      throw {
        error,
        latencyMs: roundLatency(
          Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        ),
      } satisfies AdapterExecutionFailure;
    }
  }
}

export function createDefaultOrchestrator(): PsvOrchestrator {
  const registry = new AdapterRegistry();
  registry.register(NppesAdapter);
  registry.register(OigLeieAdapter);
  registry.register(NursysAdapter);
  registry.register(DeaAdapter);
  registry.register(StateBoardAdapter);

  return new PsvOrchestrator(registry, getPsvCacheInstance());
}
