/**
 * Adapter pattern for mode-aware service implementations
 *
 * Provides interfaces and base implementations for services that need
 * different behavior in test vs production modes.
 */

import { assertNoNetwork, getNetworkTimeout, isTestMode } from './mode';

/**
 * Generic adapter interface for services that have
 * test (in-memory) and production (network) implementations
 */
export interface ServiceAdapter<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
  clear?(): void; // Optional: For test adapters to reset state
}

/**
 * Base class for network-based service adapters
 * Enforces network call assertions and timeout policies
 */
export abstract class NetworkServiceAdapter<TRequest, TResponse>
  implements ServiceAdapter<TRequest, TResponse> {

  constructor(
    protected readonly baseUrl: string,
    protected readonly operationName: string
  ) {}

  /**
   * Execute the service call with network enforcement
   */
  async execute(request: TRequest): Promise<TResponse> {
    assertNoNetwork(this.operationName);

    const timeout = getNetworkTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.makeRequest(request, controller.signal);
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Implement this method to make the actual network request
   */
  protected abstract makeRequest(
    request: TRequest,
    signal: AbortSignal
  ): Promise<TResponse>;
}

/**
 * Factory function to create mode-aware service adapters
 *
 * Automatically selects test or production implementation based on NODE_ENV
 *
 * @param testAdapter - In-memory adapter for test mode
 * @param prodAdapter - Network adapter for dev/prod modes
 * @returns The appropriate adapter for current mode
 *
 * @example
 * ```typescript
 * const adapter = createModeAwareAdapter(
 *   new InMemoryStatusListAllocator(),
 *   new HttpStatusListAllocator('https://status.vitalcv.ai')
 * );
 *
 * const result = await adapter.execute(request);
 * ```
 */
export function createModeAwareAdapter<TRequest, TResponse>(
  testAdapter: ServiceAdapter<TRequest, TResponse>,
  prodAdapter: ServiceAdapter<TRequest, TResponse>
): ServiceAdapter<TRequest, TResponse> {
  return isTestMode() ? testAdapter : prodAdapter;
}
