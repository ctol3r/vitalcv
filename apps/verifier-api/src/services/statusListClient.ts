/**
 * Status List Client
 *
 * MODE-AWARE: Uses in-memory adapter in test mode, HTTP in dev/prod
 */

import { isTestMode, assertNoNetwork, getNetworkTimeout } from '@vitalcv/runtime-mode';

export type TrustOutcome =
  | 'VALID'
  | 'REVOKED'
  | 'EXPIRED'
  | 'INVALID_SIGNATURE'
  | 'UNCHECKABLE'
  | 'MALFORMED';

export interface StatusListAllocation {
  status_url: string;
  status_list_url: string;
  list_id: string;
  index: number;
  allocated_at: string;
}

export interface RevocationResult {
  revoked: boolean;
  credential_id: string;
  list_id: string;
  index: number;
  revoked_at: string;
  previous_state: 'valid' | 'revoked';
}

export interface StatusCheckResult {
  credential_id: string;
  status: 'valid' | 'revoked' | 'unknown';
  list_id: string;
  index: number;
  checked_at: string;
  revoked_at?: string;
}

/**
 * In-memory adapter for test mode
 */
class InMemoryStatusListAdapter {
  private allocations: Map<string, StatusListAllocation> = new Map();
  private revocations: Set<string> = new Set();

  allocate(credential_id: string, list_id: string = 'default'): StatusListAllocation {
    // Idempotent: return existing allocation if present
    const existing = this.allocations.get(credential_id);
    if (existing) {
      return existing;
    }

    // Allocate new index
    const index = this.allocations.size;
    const allocation: StatusListAllocation = {
      status_url: 'https://status.test.local',
      status_list_url: `https://status.test.local/status-list/${list_id}`,
      list_id,
      index,
      allocated_at: new Date().toISOString(),
    };

    this.allocations.set(credential_id, allocation);
    return allocation;
  }

  revoke(credential_id: string, list_id: string): RevocationResult {
    const allocation = this.allocations.get(credential_id);
    if (!allocation) {
      throw new Error(`Credential ${credential_id} not allocated`);
    }

    const previous_state = this.revocations.has(credential_id) ? 'revoked' : 'valid';
    this.revocations.add(credential_id);

    return {
      revoked: true,
      credential_id,
      list_id,
      index: allocation.index,
      revoked_at: new Date().toISOString(),
      previous_state,
    };
  }

  check(credential_id: string): StatusCheckResult {
    const allocation = this.allocations.get(credential_id);

    if (!allocation) {
      return {
        credential_id,
        status: 'unknown',
        list_id: 'default',
        index: -1,
        checked_at: new Date().toISOString(),
      };
    }

    const status = this.revocations.has(credential_id) ? 'revoked' : 'valid';
    const result: StatusCheckResult = {
      credential_id,
      status,
      list_id: allocation.list_id,
      index: allocation.index,
      checked_at: new Date().toISOString(),
    };

    if (status === 'revoked') {
      result.revoked_at = new Date().toISOString();
    }

    return result;
  }

  fetchList(list_id: string): Record<string, unknown> {
    // Return mock StatusList2021Credential
    return {
      type: 'StatusList2021Credential',
      list_id,
      encodedList: 'mock-bitstring',
    };
  }

  clear(): void {
    this.allocations.clear();
    this.revocations.clear();
  }
}

// Global in-memory adapter
const inMemoryAdapter = new InMemoryStatusListAdapter();

/**
 * Clear in-memory state (for test cleanup)
 */
export function clearInMemoryStatusList(): void {
  inMemoryAdapter.clear();
}

/**
 * Status List Client
 */
export class StatusListClient {
  constructor(
    private readonly baseUrl: string = process.env.STATUS_SERVICE_URL || 'https://status.vitalcv.ai'
  ) {}

  async allocate(credential_id: string, list_id: string = 'default'): Promise<StatusListAllocation> {
    if (!credential_id) {
      throw new Error('credential_id is required');
    }

    // TEST MODE: Use in-memory adapter
    if (isTestMode()) {
      return inMemoryAdapter.allocate(credential_id, list_id);
    }

    // DEV/PROD MODE: HTTP call
    assertNoNetwork('StatusListClient.allocate');

    const timeout = getNetworkTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/status-list/allocate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_id,
          list_id,
          purpose: 'revocation',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Status list allocation failed: ${response.status}`);
      }

      return await response.json() as StatusListAllocation;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async revoke(credential_id: string, list_id: string = 'default', reason?: string): Promise<RevocationResult> {
    if (!credential_id) {
      throw new Error('credential_id is required');
    }

    // TEST MODE: Use in-memory adapter
    if (isTestMode()) {
      return inMemoryAdapter.revoke(credential_id, list_id);
    }

    // DEV/PROD MODE: HTTP call
    assertNoNetwork('StatusListClient.revoke');

    const timeout = getNetworkTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/status-list/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_id,
          list_id,
          reason,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Status list revocation failed: ${response.status}`);
      }

      return await response.json() as RevocationResult;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async check(credential_id: string): Promise<StatusCheckResult> {
    if (!credential_id) {
      throw new Error('credential_id is required');
    }

    // TEST MODE: Use in-memory adapter
    if (isTestMode()) {
      return inMemoryAdapter.check(credential_id);
    }

    // DEV/PROD MODE: HTTP call
    assertNoNetwork('StatusListClient.check');

    const timeout = getNetworkTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/status-list/check/${credential_id}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Status list check failed: ${response.status}`);
      }

      return await response.json() as StatusCheckResult;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async fetchList(list_id: string): Promise<Record<string, unknown>> {
    // TEST MODE: Use in-memory adapter
    if (isTestMode()) {
      return inMemoryAdapter.fetchList(list_id);
    }

    // DEV/PROD MODE: HTTP call
    assertNoNetwork('StatusListClient.fetchList');

    const timeout = getNetworkTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/status-list/${list_id}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Status list fetch failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}
