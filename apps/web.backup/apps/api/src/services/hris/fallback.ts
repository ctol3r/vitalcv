import { RegionEndpoint } from './types';

export interface RegionAttempt<T = unknown> {
  region: string;
  startedAt: string;
  latencyMs: number;
  success: boolean;
  result?: T;
  error?: string;
}

export interface RegionFallbackResult<T> {
  region: string;
  result: T;
  attempts: RegionAttempt<T>[];
}

interface RegionFallbackOptions {
  maxAttempts?: number;
}

export async function executeWithRegionFallback<T>(
  endpoints: RegionEndpoint[],
  executor: (endpoint: RegionEndpoint) => Promise<T>,
  options: RegionFallbackOptions = {},
): Promise<RegionFallbackResult<T>> {
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    throw new Error('no_region_endpoints_configured');
  }
  const attempts: RegionAttempt<T>[] = [];
  const maxAttempts = Math.max(1, options.maxAttempts ?? endpoints.length);

  for (let i = 0; i < Math.min(endpoints.length, maxAttempts); i += 1) {
    const endpoint = endpoints[i]!;
    const startedAt = new Date();
    const attempt: RegionAttempt<T> = {
      region: endpoint.region,
      startedAt: startedAt.toISOString(),
      latencyMs: 0,
      success: false,
    };

    try {
      const result = await executor(endpoint);
      attempt.latencyMs = Date.now() - startedAt.getTime();
      attempt.success = true;
      attempt.result = result;
      attempts.push(attempt);
      return {
        region: endpoint.region,
        result,
        attempts,
      };
    } catch (error) {
      attempt.latencyMs = Date.now() - startedAt.getTime();
      attempt.error = error instanceof Error ? error.message : String(error);
      attempts.push(attempt);
    }
  }

  const errors = attempts.map((attempt) => `${attempt.region}:${attempt.error}`).join('; ');
  const failure = new Error(errors || 'hris_region_fallback_failed');
  (failure as Error & { attempts?: RegionAttempt[] }).attempts = attempts;
  throw failure;
}


