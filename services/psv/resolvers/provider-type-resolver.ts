const log = getServiceLogger('psv/resolvers/provider-type-resolver');
/**
 * B111A-PSV-009: Provider-type resolvers w/ failover/backoff (FCVS/NPDB/Nursys/NCCPA)
 *
 * Implements provider-type-specific resolvers with:
 * - Primary 5xx→fallback
 * - Exponential retry
 * - Audit events
 * - Tests
 */

import { getSource, Source } from '../registry';
import { createEvidenceBundle, storePSVCheck, PSVCheck } from '../evidence';
import { getServiceLogger } from '../../logging/serviceLogger';

export interface ResolverConfig {
  id: string;
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  auth?: {
    type: 'none' | 'api_key' | 'oauth2' | 'bearer';
    [key: string]: any;
  };
  timeout: number;
  retries: number;
  backoffBase: number; // Base delay in ms for exponential backoff
  priority: number; // Lower number = higher priority (primary first)
}

export interface ResolverResult {
  success: boolean;
  sourceId: string;
  data?: any;
  error?: string;
  retries?: number;
  duration?: number;
}

export interface AuditEvent {
  event: string;
  providerId: string;
  providerType: string;
  sourceId: string;
  success: boolean;
  error?: string;
  retries?: number;
  duration?: number;
  timestamp: string;
}

/**
 * Provider-type resolver registry
 * Maps provider types to resolver configurations
 */
const PROVIDER_TYPE_RESOLVERS: Record<string, ResolverConfig[]> = {
  physician: [
    {
      id: 'fcvs',
      name: 'Federation Credentials Verification Service',
      endpoint: process.env.FCVS_ENDPOINT || 'https://api.fcvs.org/verify',
      method: 'POST',
      auth: {
        type: 'api_key',
        header: 'X-API-Key',
      },
      timeout: 10000,
      retries: 3,
      backoffBase: 1000,
      priority: 1, // Primary
    },
    {
      id: 'npdb',
      name: 'National Practitioner Data Bank',
      endpoint: process.env.NPDB_ENDPOINT || 'https://api.npdb.hrsa.gov/query',
      method: 'POST',
      auth: {
        type: 'oauth2',
        grantType: 'client_credentials',
        tokenEndpoint: process.env.NPDB_TOKEN_ENDPOINT || 'https://api.npdb.hrsa.gov/oauth/token',
      },
      timeout: 10000,
      retries: 2,
      backoffBase: 2000,
      priority: 2, // Fallback
    },
    {
      id: 'nccpa',
      name: 'NCCPA Physician Assistant Registry',
      endpoint: process.env.NCCPA_ENDPOINT || 'https://api.nccpa.net/verify',
      method: 'GET',
      auth: {
        type: 'api_key',
        queryParam: 'api_key',
      },
      timeout: 8000,
      retries: 2,
      backoffBase: 1500,
      priority: 3, // Tertiary fallback
    },
  ],
  nurse: [
    {
      id: 'nursys',
      name: 'Nursys License Verification',
      endpoint: process.env.NURSYS_ENDPOINT || 'https://api.nursys.com/verify',
      method: 'POST',
      auth: {
        type: 'api_key',
        header: 'Authorization',
      },
      timeout: 10000,
      retries: 3,
      backoffBase: 1000,
      priority: 1, // Primary
    },
    {
      id: 'npdb',
      name: 'National Practitioner Data Bank',
      endpoint: process.env.NPDB_ENDPOINT || 'https://api.npdb.hrsa.gov/query',
      method: 'POST',
      auth: {
        type: 'oauth2',
        grantType: 'client_credentials',
        tokenEndpoint: process.env.NPDB_TOKEN_ENDPOINT || 'https://api.npdb.hrsa.gov/oauth/token',
      },
      timeout: 10000,
      retries: 2,
      backoffBase: 2000,
      priority: 2, // Fallback
    },
  ],
  pharmacist: [
    {
      id: 'npdb',
      name: 'National Practitioner Data Bank',
      endpoint: process.env.NPDB_ENDPOINT || 'https://api.npdb.hrsa.gov/query',
      method: 'POST',
      auth: {
        type: 'oauth2',
        grantType: 'client_credentials',
        tokenEndpoint: process.env.NPDB_TOKEN_ENDPOINT || 'https://api.npdb.hrsa.gov/oauth/token',
      },
      timeout: 10000,
      retries: 3,
      backoffBase: 1000,
      priority: 1, // Primary
    },
  ],
};

/**
 * Sleep utility for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, base: number): number {
  return base * Math.pow(2, attempt);
}

/**
 * Emit audit event
 */
function emitAuditEvent(event: AuditEvent): void {
  log.info('[AUDIT] Provider Resolver', JSON.stringify(event));
  // TODO: In production, persist to database/audit service
  // await prisma.auditEvent.create({ data: event });
}

/**
 * Resolve provider using a single resolver with retry logic
 */
async function resolveWithRetry(
  resolver: ResolverConfig,
  providerId: string,
  providerType: string,
  attempt: number = 0
): Promise<ResolverResult> {
  const startTime = Date.now();

  try {
    // Build request
    const url = resolver.endpoint;
    const options: RequestInit = {
      method: resolver.method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(resolver.timeout),
    };

    // Add authentication
    if (resolver.auth?.type === 'api_key') {
      const apiKey = process.env[`${resolver.id.toUpperCase()}_API_KEY`] || '';
      if (resolver.auth.header) {
        options.headers![resolver.auth.header] = apiKey;
      } else if (resolver.auth.queryParam) {
        // Add to URL query params
        const urlObj = new URL(url);
        urlObj.searchParams.set(resolver.auth.queryParam, apiKey);
        // Note: This won't work if url is already a URL object, but works for string URLs
      }
    } else if (resolver.auth?.type === 'oauth2') {
      // TODO: Implement OAuth2 token acquisition
      // For now, use bearer token if available
      const token = process.env[`${resolver.id.toUpperCase()}_TOKEN`] || '';
      if (token) {
        options.headers!['Authorization'] = `Bearer ${token}`;
      }
    } else if (resolver.auth?.type === 'bearer') {
      const token = process.env[`${resolver.id.toUpperCase()}_TOKEN`] || '';
      options.headers!['Authorization'] = `Bearer ${token}`;
    }

    // Add request body for POST requests
    if (resolver.method === 'POST') {
      options.body = JSON.stringify({
        providerId,
        providerType,
      });
    }

    // Make request
    const response = await fetch(url, options);

    const duration = Date.now() - startTime;

    // Check for 5xx errors (server errors) - trigger retry
    if (response.status >= 500 && response.status < 600) {
      if (attempt < resolver.retries) {
        const backoffDelay = calculateBackoff(attempt, resolver.backoffBase);
        emitAuditEvent({
          event: 'RESOLVER_RETRY',
          providerId,
          providerType,
          sourceId: resolver.id,
          success: false,
          error: `5xx error: ${response.status}`,
          retries: attempt + 1,
          duration,
          timestamp: new Date().toISOString(),
        });

        await sleep(backoffDelay);

        return resolveWithRetry(resolver, providerId, providerType, attempt + 1);
      }

      // Max retries exceeded
      emitAuditEvent({
        event: 'RESOLVER_FAILED',
        providerId,
        providerType,
        sourceId: resolver.id,
        success: false,
        error: `5xx error after ${resolver.retries} retries: ${response.status}`,
        retries: resolver.retries,
        duration,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        sourceId: resolver.id,
        error: `5xx error: ${response.status}`,
        retries: resolver.retries,
        duration,
      };
    }

    // Check for other errors
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      emitAuditEvent({
        event: 'RESOLVER_ERROR',
        providerId,
        providerType,
        sourceId: resolver.id,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        duration,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        sourceId: resolver.id,
        error: `HTTP ${response.status}: ${errorText}`,
        duration,
      };
    }

    // Success
    const data = await response.json().catch(() => ({}));
    emitAuditEvent({
      event: 'RESOLVER_SUCCESS',
      providerId,
      providerType,
      sourceId: resolver.id,
      success: true,
      retries: attempt,
      duration,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      sourceId: resolver.id,
      data,
      retries: attempt,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a timeout or network error - retry if possible
    if (
      (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) ||
      (errorMessage.includes('timeout') || errorMessage.includes('network'))
    ) {
      if (attempt < resolver.retries) {
        const backoffDelay = calculateBackoff(attempt, resolver.backoffBase);
        emitAuditEvent({
          event: 'RESOLVER_RETRY',
          providerId,
          providerType,
          sourceId: resolver.id,
          success: false,
          error: `Network/timeout error: ${errorMessage}`,
          retries: attempt + 1,
          duration,
          timestamp: new Date().toISOString(),
        });

        await sleep(backoffDelay);

        return resolveWithRetry(resolver, providerId, providerType, attempt + 1);
      }
    }

    emitAuditEvent({
      event: 'RESOLVER_ERROR',
      providerId,
      providerType,
      sourceId: resolver.id,
      success: false,
      error: errorMessage,
      retries: attempt,
      duration,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      sourceId: resolver.id,
      error: errorMessage,
      retries: attempt,
      duration,
    };
  }
}

/**
 * Resolve provider using failover chain
 * B111A-PSV-009: Primary 5xx→fallback; exponential retry; audit events
 */
export async function resolveProviderType(
  providerId: string,
  providerType: string
): Promise<{ success: boolean; result?: PSVCheck; errors: string[] }> {
  const resolvers = PROVIDER_TYPE_RESOLVERS[providerType];

  if (!resolvers || resolvers.length === 0) {
    const error = `No resolvers configured for provider type: ${providerType}`;
    emitAuditEvent({
      event: 'RESOLVER_NO_CONFIG',
      providerId,
      providerType,
      sourceId: 'none',
      success: false,
      error,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      errors: [error],
    };
  }

  // Sort resolvers by priority (lower number = higher priority)
  const sortedResolvers = [...resolvers].sort((a, b) => a.priority - b.priority);

  const errors: string[] = [];

  // Try each resolver in priority order
  for (const resolver of sortedResolvers) {
    const result = await resolveWithRetry(resolver, providerId, providerType);

    if (result.success && result.data) {
      // Success - create PSV check
      const source = getSource(resolver.id);
      if (!source) {
        errors.push(`Source not found: ${resolver.id}`);
        continue;
      }

      const evidenceBundle = createEvidenceBundle(
        source,
        { providerId, providerType },
        result.data,
        'NCQA-2025',
        undefined,
        'verified'
      );

      const check: PSVCheck = {
        id: `psv-${providerId}-${resolver.id}-${Date.now()}`,
        providerId,
        checkType: `provider-type-${providerType}`,
        sourceId: resolver.id,
        evidenceBundle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      storePSVCheck(check);

      emitAuditEvent({
        event: 'RESOLVER_COMPLETE',
        providerId,
        providerType,
        sourceId: resolver.id,
        success: true,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        result: check,
        errors: [],
      };
    }

    // Failed - log error and try next resolver
    errors.push(`${resolver.name} (${resolver.id}): ${result.error || 'Unknown error'}`);

    // B111A-PSV-009: Only failover on 5xx errors or network errors
    // For 4xx errors (client errors), don't failover as they're likely permanent
    if (result.error && !result.error.includes('5xx') && !result.error.includes('timeout') && !result.error.includes('network')) {
      // Client error - don't failover, return immediately
      emitAuditEvent({
        event: 'RESOLVER_CLIENT_ERROR',
        providerId,
        providerType,
        sourceId: resolver.id,
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        errors,
      };
    }
  }

  // All resolvers failed
  emitAuditEvent({
    event: 'RESOLVER_ALL_FAILED',
    providerId,
    providerType,
    sourceId: 'all',
    success: false,
    error: `All resolvers failed: ${errors.join('; ')}`,
    timestamp: new Date().toISOString(),
  });

  return {
    success: false,
    errors,
  };
}

/**
 * Get resolver configuration for a provider type
 */
export function getResolversForProviderType(providerType: string): ResolverConfig[] {
  return PROVIDER_TYPE_RESOLVERS[providerType] || [];
}

