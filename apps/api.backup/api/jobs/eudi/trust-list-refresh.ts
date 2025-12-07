/**
 * B114A-EUDI-007: EUDI trust-list nightly refresh job
 *
 * Runs daily to refresh the EUDI trust list:
 * - Fetches latest trust list from pinned endpoint
 * - Verifies signature
 * - Updates cache
 * - Logs refresh status
 */

import {
  fetchTrustList,
  getCachedTrustList,
  isTrustListStale,
  PINNED_TRUST_LIST_HOSTNAMES,
} from '../../apps/verifier-api/src/eu/eudiTrustList.js';

const TRUST_LIST_URL = process.env.EUDI_TRUST_LIST_URL || 'https://eudi.ec.europa.eu/trust-list';
const TRUST_LIST_PUBLIC_KEY = process.env.EUDI_TRUST_LIST_PUBLIC_KEY || '';

/**
 * Refresh trust list
 */
export async function refreshTrustList(): Promise<{
  success: boolean;
  error?: string;
  trustListVersion?: string;
  issuedAt?: string;
}> {
  console.log('[EUDI Trust List Refresh] Starting nightly refresh...');

  if (!TRUST_LIST_PUBLIC_KEY) {
    const error = 'EUDI_TRUST_LIST_PUBLIC_KEY environment variable not set';
    console.error(`[EUDI Trust List Refresh] ${error}`);
    return { success: false, error };
  }

  try {
    // Fetch fresh trust list
    const result = await fetchTrustList(TRUST_LIST_URL, TRUST_LIST_PUBLIC_KEY);

    if (!result.success) {
      console.error(`[EUDI Trust List Refresh] Failed: ${result.error}`);
      return {
        success: false,
        error: result.error,
      };
    }

    const trustList = result.trustList!;
    console.log(`[EUDI Trust List Refresh] Successfully refreshed trust list`, {
      version: trustList.version,
      issuer: trustList.issuer,
      issuedAt: trustList.issuedAt,
      entryCount: trustList.entries.length,
      pinnedHostnames: PINNED_TRUST_LIST_HOSTNAMES,
    });

    return {
      success: true,
      trustListVersion: trustList.version,
      issuedAt: trustList.issuedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    console.error(`[EUDI Trust List Refresh] Error: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check trust list status
 */
export function checkTrustListStatus(): {
  isStale: boolean;
  isFresh: boolean;
  ageDays: number;
  needsRefresh: boolean;
} {
  const cached = getCachedTrustList();

  if (!cached) {
    return {
      isStale: true,
      isFresh: false,
      ageDays: 999,
      needsRefresh: true,
    };
  }

  const issuedAt = new Date(cached.issuedAt).getTime();
  const now = Date.now();
  const ageMs = now - issuedAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const isStale = isTrustListStale(issuedAt);

  return {
    isStale,
    isFresh: !isStale,
    ageDays,
    needsRefresh: isStale || ageDays > 1, // Refresh if stale or older than 1 day
  };
}

/**
 * Main refresh job entry point
 * B114A-EUDI-007: Nightly refresh job
 */
export async function runTrustListRefreshJob(): Promise<void> {
  console.log('[EUDI Trust List Refresh Job] Starting...');

  // Check current status
  const status = checkTrustListStatus();
  console.log('[EUDI Trust List Refresh Job] Current status:', status);

  if (status.needsRefresh) {
    console.log('[EUDI Trust List Refresh Job] Trust list needs refresh, fetching...');
    const result = await refreshTrustList();

    if (result.success) {
      console.log('[EUDI Trust List Refresh Job] Refresh completed successfully');
    } else {
      console.error(`[EUDI Trust List Refresh Job] Refresh failed: ${result.error}`);
      // In production, send alert (PagerDuty, etc.)
    }
  } else {
    console.log('[EUDI Trust List Refresh Job] Trust list is fresh, skipping refresh');
  }
}

// If run directly (not imported), execute the job
if (require.main === module) {
  runTrustListRefreshJob()
    .then(() => {
      console.log('[EUDI Trust List Refresh Job] Completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[EUDI Trust List Refresh Job] Fatal error:', error);
      process.exit(1);
    });
}

