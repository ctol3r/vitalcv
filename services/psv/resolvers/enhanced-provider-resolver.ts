import { getServiceLogger } from '../../logging/serviceLogger';
const log = getServiceLogger('psv/resolvers/enhanced-provider-resolver');
/**
 * B128A-PSV-009: Provider-type resolvers with failover and backoff
 * Implements resolvers for FCVS, NPDB, Nursys, NCCPA with failover and exponential backoff
 */

export interface ProviderSource {
  name: 'FCVS' | 'NPDB' | 'Nursys' | 'NCCPA';
  url: string;
  priority: number; // Lower is higher priority
  timeout: number; // Request timeout in ms
  retryAttempts: number;
}

export interface ProviderRecord {
  npi: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  licenseState?: string;
  specialty?: string;
  status: 'active' | 'inactive' | 'suspended' | 'revoked';
  verifiedAt: string;
  source: string;
}

export interface ResolverResponse {
  success: boolean;
  data?: ProviderRecord;
  source?: string;
  error?: string;
  attempts: number;
  duration: number;
}

// B128A-PSV-009: Provider source configurations with failover
const PROVIDER_SOURCES: ProviderSource[] = [
  {
    name: 'FCVS',
    url: process.env.FCVS_API_URL || 'https://fcvs.fsmb.org/api/v1',
    priority: 1, // Primary
    timeout: 5000,
    retryAttempts: 3,
  },
  {
    name: 'NPDB',
    url: process.env.NPDB_API_URL || 'https://npdb.hrsa.gov/api/v1',
    priority: 2, // Fallback
    timeout: 5000,
    retryAttempts: 3,
  },
  {
    name: 'Nursys',
    url: process.env.NURSYS_API_URL || 'https://nursys.com/api/v1',
    priority: 3, // Tertiary
    timeout: 5000,
    retryAttempts: 2,
  },
  {
    name: 'NCCPA',
    url: process.env.NCCPA_API_URL || 'https://nccpa.net/api/v1',
    priority: 4, // Quaternary
    timeout: 5000,
    retryAttempts: 2,
  },
];

// Audit event store (in production, use database)
interface AuditEvent {
  timestamp: string;
  source: string;
  npi: string;
  success: boolean;
  error?: string;
  attempts: number;
  duration: number;
  failedOver?: boolean;
}

const auditEvents: AuditEvent[] = [];

/**
 * B128A-PSV-009: Exponential backoff with jitter
 * Returns delay in milliseconds for retry attempt
 */
function calculateBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter (random 0-20% variation) to prevent thundering herd
  const jitter = Math.random() * 0.2 * exponentialDelay;

  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * B128A-PSV-009: Delay function for backoff
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * B128A-PSV-009: Fetch provider data from a single source with retry
 */
async function fetchFromSource(
  source: ProviderSource,
  npi: string
): Promise<{ success: boolean; data?: ProviderRecord; error?: string; attempts: number }> {
  let attempts = 0;
  let lastError: string | undefined;

  while (attempts < source.retryAttempts) {
    attempts++;

    try {
      // B128A-PSV-009: Apply exponential backoff on retry attempts
      if (attempts > 1) {
        const backoffDelay = calculateBackoffDelay(attempts - 1);
        log.info(`[PSV] Retry attempt ${attempts} for ${source.name} after ${backoffDelay}ms backoff`);
        await delay(backoffDelay);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), source.timeout);

      const response = await fetch(`${source.url}/providers/${npi}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VitalCV-PSV/1.0',
          'Authorization': `Bearer ${process.env[`${source.name}_API_KEY`] || 'demo-key'}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // B128A-PSV-009: Primary 5xx errors trigger failover
        if (response.status >= 500) {
          lastError = `${source.name} returned ${response.status} (server error)`;
          log.warn(`[PSV] ${lastError}, will retry/failover`);
          continue; // Retry on 5xx
        } else if (response.status === 429) {
          // Rate limit - backoff and retry
          lastError = `${source.name} rate limited (429)`;
          log.warn(`[PSV] ${lastError}, applying backoff`);
          continue; // Retry with backoff
        } else if (response.status === 404) {
          // Not found - don't retry, fail immediately
          return {
            success: false,
            error: `Provider not found in ${source.name}`,
            attempts,
          };
        } else {
          // Client error - don't retry
          return {
            success: false,
            error: `${source.name} returned ${response.status}`,
            attempts,
          };
        }
      }

      const data = await response.json();

      // Transform to our format
      const providerRecord: ProviderRecord = {
        npi: data.npi || npi,
        firstName: data.firstName || data.first_name || '',
        lastName: data.lastName || data.last_name || '',
        licenseNumber: data.licenseNumber || data.license_number,
        licenseState: data.licenseState || data.license_state,
        specialty: data.specialty,
        status: data.status || 'active',
        verifiedAt: new Date().toISOString(),
        source: source.name,
      };

      return {
        success: true,
        data: providerRecord,
        attempts,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof Error && error.name === 'AbortError') {
        lastError = `${source.name} request timed out after ${source.timeout}ms`;
      }

      log.error(`[PSV] ${source.name} fetch attempt ${attempts} failed:`, lastError);

      // Continue to retry
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError || `Failed after ${attempts} attempts`,
    attempts,
  };
}

/**
 * B128A-PSV-009: Resolve provider with failover across sources
 * Tries sources in priority order, failing over on 5xx errors
 */
export async function resolveProvider(npi: string): Promise<ResolverResponse> {
  const startTime = Date.now();
  let totalAttempts = 0;
  let failedOver = false;

  // Sort sources by priority (ascending)
  const sortedSources = [...PROVIDER_SOURCES].sort((a, b) => a.priority - b.priority);

  for (const source of sortedSources) {
    log.info(`[PSV] Attempting to resolve NPI ${npi} from ${source.name} (priority ${source.priority})`);

    const result = await fetchFromSource(source, npi);
    totalAttempts += result.attempts;

    if (result.success && result.data) {
      const duration = Date.now() - startTime;

      // B128A-PSV-009: Audit event logged
      const auditEvent: AuditEvent = {
        timestamp: new Date().toISOString(),
        source: source.name,
        npi,
        success: true,
        attempts: totalAttempts,
        duration,
        failedOver,
      };
      auditEvents.push(auditEvent);
      log.info(`[PSV] Successfully resolved NPI ${npi} from ${source.name} in ${duration}ms`);

      return {
        success: true,
        data: result.data,
        source: source.name,
        attempts: totalAttempts,
        duration,
      };
    }

    // B128A-PSV-009: Primary 5xx → failover to next source
    if (result.error?.includes('server error') || result.error?.includes('timed out')) {
      log.warn(`[PSV] ${source.name} failed (${result.error}), failing over to next source`);
      failedOver = true;
      continue; // Try next source
    }

    // For other errors (404, 4xx), don't failover - return immediately
    if (result.error?.includes('not found') || result.error?.includes('40')) {
      const duration = Date.now() - startTime;

      // Audit failed attempt
      const auditEvent: AuditEvent = {
        timestamp: new Date().toISOString(),
        source: source.name,
        npi,
        success: false,
        error: result.error,
        attempts: totalAttempts,
        duration,
        failedOver: false,
      };
      auditEvents.push(auditEvent);

      return {
        success: false,
        error: result.error,
        source: source.name,
        attempts: totalAttempts,
        duration,
      };
    }

    // Unknown error - try failover
    log.warn(`[PSV] ${source.name} failed (${result.error}), trying failover`);
    failedOver = true;
  }

  // All sources exhausted
  const duration = Date.now() - startTime;

  // Audit final failure
  const auditEvent: AuditEvent = {
    timestamp: new Date().toISOString(),
    source: 'all',
    npi,
    success: false,
    error: 'All sources exhausted',
    attempts: totalAttempts,
    duration,
    failedOver: true,
  };
  auditEvents.push(auditEvent);

  return {
    success: false,
    error: `Failed to resolve provider from all sources (${totalAttempts} attempts)`,
    attempts: totalAttempts,
    duration,
  };
}

/**
 * Get audit events for monitoring
 */
export function getAuditEvents(limit: number = 100): AuditEvent[] {
  return auditEvents.slice(-limit);
}

/**
 * Get resolver metrics
 */
export function getResolverMetrics(): {
  totalRequests: number;
  successRate: number;
  failoverRate: number;
  averageDuration: number;
  sourceBreakdown: Record<string, { attempts: number; successes: number; failures: number }>;
} {
  const total = auditEvents.length;
  const successes = auditEvents.filter(e => e.success).length;
  const failovers = auditEvents.filter(e => e.failedOver).length;
  const avgDuration = total > 0
    ? auditEvents.reduce((sum, e) => sum + e.duration, 0) / total
    : 0;

  // Source breakdown
  const sourceBreakdown: Record<string, { attempts: number; successes: number; failures: number }> = {};

  for (const event of auditEvents) {
    if (!sourceBreakdown[event.source]) {
      sourceBreakdown[event.source] = { attempts: 0, successes: 0, failures: 0 };
    }
    sourceBreakdown[event.source].attempts += event.attempts;
    if (event.success) {
      sourceBreakdown[event.source].successes++;
    } else {
      sourceBreakdown[event.source].failures++;
    }
  }

  return {
    totalRequests: total,
    successRate: total > 0 ? (successes / total) * 100 : 0,
    failoverRate: total > 0 ? (failovers / total) * 100 : 0,
    averageDuration: avgDuration,
    sourceBreakdown,
  };
}

/**
 * Clear audit events (for testing)
 */
export function clearAuditEvents(): void {
  auditEvents.length = 0;
}

// Export for testing
export { PROVIDER_SOURCES, calculateBackoffDelay };

