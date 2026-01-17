/**
 * Status List Allocation Service
 *
 * MODE-AWARE: Uses in-memory adapter in test mode, HTTP in dev/prod
 * See docs/execution-modes.md for policy
 */

import { isTestMode, assertNoNetwork, getNetworkTimeout } from '@vitalcv/runtime-mode';

const STATUS_API_BASE_URL = (process.env.STATUS_URL || process.env.PUBLIC_STATUS_URL || 'https://status.vitalcv.ai')
  .replace(/\/$/, '');
const DEFAULT_LIST_ID = process.env.STATUS_LIST_ID || 'default';

export interface StatusListAllocation {
  statusUrl: string;
  statusListUrl: string;
  listId: string;
  index: number;
}

/**
 * In-memory status list allocator for test mode
 * Maintains per-list index counters to simulate status list allocation without network calls
 */
class InMemoryStatusListAllocator {
  private allocations: Map<string, { nextIndex: number; credentials: Map<string, number> }> = new Map();

  allocate(credentialId: string, listId: string): StatusListAllocation {
    if (!this.allocations.has(listId)) {
      this.allocations.set(listId, {
        nextIndex: 0,
        credentials: new Map(),
      });
    }

    const list = this.allocations.get(listId)!;

    // Check if this credential already has an allocation (idempotency)
    if (list.credentials.has(credentialId)) {
      const existingIndex = list.credentials.get(credentialId)!;
      return this.buildAllocation(listId, existingIndex);
    }

    // Allocate new index
    const index = list.nextIndex;
    list.nextIndex += 1;
    list.credentials.set(credentialId, index);

    return this.buildAllocation(listId, index);
  }

  private buildAllocation(listId: string, index: number): StatusListAllocation {
    const statusUrl = 'https://status.test.local/revocation-list';
    const statusListUrl = `${statusUrl}/${encodeURIComponent(listId)}`;

    return {
      statusUrl,
      statusListUrl,
      listId,
      index,
    };
  }

  clear(): void {
    this.allocations.clear();
  }

  getAllocatedIndex(credentialId: string, listId: string): number | null {
    const list = this.allocations.get(listId);
    return list?.credentials.get(credentialId) ?? null;
  }
}

// Global in-memory allocator instance for test mode
const inMemoryAllocator = new InMemoryStatusListAllocator();

/**
 * Clear all in-memory status list allocations (for test cleanup)
 */
export function clearInMemoryAllocations(): void {
  inMemoryAllocator.clear();
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function buildStatusListUrl(statusUrl: string, listId: string): string {
  const normalized = normalizeBaseUrl(statusUrl);
  const encodedListId = encodeURIComponent(listId);
  if (normalized.endsWith(`/${encodedListId}`)) {
    return normalized;
  }
  return `${normalized}/${encodedListId}`;
}

function parseStatusListIndex(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

export function buildCredentialStatus(allocation: StatusListAllocation): Record<string, unknown> {
  return {
    id: `${allocation.statusListUrl}#${allocation.index}`,
    type: 'StatusList2021Entry',
    statusPurpose: 'revocation',
    statusListIndex: String(allocation.index),
    statusListCredential: allocation.statusListUrl,
    statusUrl: allocation.statusUrl,
    listId: allocation.listId,
    index: allocation.index,
  };
}

export function buildStatusClaim(allocation: StatusListAllocation): Record<string, unknown> {
  return {
    status_list: {
      uri: allocation.statusListUrl,
      idx: allocation.index,
      list_id: allocation.listId,
    },
    statusUrl: allocation.statusUrl,
    listId: allocation.listId,
    index: allocation.index,
  };
}

/**
 * Allocate a status list entry for a credential
 *
 * MODE-AWARE:
 * - TEST: Uses in-memory allocator (no network calls)
 * - DEV/PROD: Calls remote status list service
 *
 * @param credentialId - Unique identifier for the credential
 * @param listId - Status list identifier (default: 'default')
 * @returns StatusListAllocation with index and URLs
 *
 * @throws Error if credentialId is missing
 * @throws Error in test mode if network call attempted
 * @throws Error in prod mode if allocation fails
 */
export async function allocateStatusListEntry(
  credentialId: string,
  listId: string = DEFAULT_LIST_ID
): Promise<StatusListAllocation> {
  if (!credentialId) {
    throw new Error('credentialId is required for status list allocation');
  }

  // TEST MODE: Use in-memory allocator
  if (isTestMode()) {
    return inMemoryAllocator.allocate(credentialId, listId);
  }

  // DEV/PROD MODE: Call remote status list service
  assertNoNetwork('allocateStatusListEntry');

  const baseUrl = normalizeBaseUrl(STATUS_API_BASE_URL);
  const timeout = getNetworkTimeout();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}/status-list/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        credential_id: credentialId,
        list_id: listId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Status list allocation failed (${response.status})`);
    }

    const payload = await response.json() as Record<string, unknown>;
    const resolvedListId = typeof payload.list_id === 'string' ? payload.list_id : listId;
    const index = parseStatusListIndex(
      payload.index ?? payload.statusListIndex ?? payload.status_list_index
    );

    if (index === null) {
      throw new Error('Status list allocation returned invalid index');
    }

    const statusUrl = typeof payload.status_url === 'string'
      ? payload.status_url
      : `${baseUrl}/status-list/compact`;
    const statusListUrl = typeof payload.status_list_url === 'string'
      ? payload.status_list_url
      : buildStatusListUrl(statusUrl, resolvedListId);

    return {
      statusUrl: normalizeBaseUrl(statusUrl),
      statusListUrl,
      listId: resolvedListId,
      index,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
