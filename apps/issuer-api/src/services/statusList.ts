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

export interface RevocationResult {
  success: boolean;
  already_revoked?: boolean;
}

/**
 * In-memory status list allocator for test mode
 * Maintains per-list index counters to simulate status list allocation without network calls
 */
class InMemoryStatusListAllocator {
  private allocations: Map<string, { nextIndex: number; credentials: Map<string, number> }> = new Map();
  private revokedCredentials: Set<string> = new Set();

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

  revoke(credentialId: string, listId: string): RevocationResult {
    // Idempotent: if already revoked, return success
    if (this.revokedCredentials.has(credentialId)) {
      return { success: true, already_revoked: true };
    }

    // Check if credential exists in this list
    const list = this.allocations.get(listId);
    if (!list || !list.credentials.has(credentialId)) {
      throw new Error(`Credential ${credentialId} not found in list ${listId}`);
    }

    this.revokedCredentials.add(credentialId);
    return { success: true, already_revoked: false };
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
    this.revokedCredentials.clear();
  }

  getAllocatedIndex(credentialId: string, listId: string): number | null {
    const list = this.allocations.get(listId);
    return list?.credentials.get(credentialId) ?? null;
  }

  isRevoked(credentialId: string): boolean {
    return this.revokedCredentials.has(credentialId);
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

/**
 * Check if a credential is revoked (test mode only)
 */
export function isCredentialRevoked(credentialId: string): boolean {
  return inMemoryAllocator.isRevoked(credentialId);
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

/**
 * Revoke a credential's status list entry
 *
 * MODE-AWARE:
 * - TEST: Uses in-memory allocator (no network calls)
 * - DEV/PROD: Calls remote status list service
 *
 * @param credentialId - Unique identifier for the credential
 * @param listId - Status list identifier (default: 'default')
 * @param reason - Optional reason for revocation
 * @returns RevocationResult indicating success
 *
 * @throws Error if credentialId is missing
 * @throws Error if credential not found in status list
 * @throws Error in test mode if network call attempted
 * @throws Error in prod mode if revocation fails
 */
export async function revokeCredential(
  credentialId: string,
  listId: string = DEFAULT_LIST_ID,
  reason?: string
): Promise<RevocationResult> {
  if (!credentialId) {
    throw new Error('credentialId is required for revocation');
  }

  // TEST MODE: Use in-memory allocator
  if (isTestMode()) {
    return inMemoryAllocator.revoke(credentialId, listId);
  }

  // DEV/PROD MODE: Call remote status list service
  assertNoNetwork('revokeCredential');

  const baseUrl = normalizeBaseUrl(STATUS_API_BASE_URL);
  const timeout = getNetworkTimeout();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}/status-list/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        credential_id: credentialId,
        list_id: listId,
        reason,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Credential ${credentialId} not found in status list`);
      }
      throw new Error(`Credential revocation failed (${response.status})`);
    }

    const payload = await response.json() as Record<string, unknown>;
    return {
      success: payload.success === true,
      already_revoked: payload.already_revoked === true,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
