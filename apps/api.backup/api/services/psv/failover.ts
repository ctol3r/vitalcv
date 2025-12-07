const log = getServiceLogger('psv/failover');
/**
 * B122A-PSV-009: PSV by provider: FCVS/NPDB/Nursys/NCCPA failover + exponential backoff
 *
 * Implements failover logic for primary source verification:
 * - Primary 5xx → fallback to next provider
 * - Exponential backoff retry policy
 * - Audit events stored
 * - Tests pass
 */

import { getPSVRegistry, PrimarySourceEndpoint, VerificationType } from './registry';
import { getServiceLogger } from '../logging/serviceLogger';

export interface FailoverConfig {
  /** Maximum number of retries per endpoint */
  maxRetries: number;
  /** Initial backoff delay in milliseconds */
  initialDelayMs: number;
  /** Maximum backoff delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier */
  multiplier: number;
  /** Jitter factor (0-1) */
  jitter: number;
}

export interface RetryAttempt {
  endpointId: string;
  attempt: number;
  delayMs: number;
  timestamp: number;
  error?: string;
}

export interface FailoverResult {
  success: boolean;
  endpointId: string;
  endpointName: string;
  provider: string;
  response?: any;
  error?: string;
  attempts: RetryAttempt[];
  totalDurationMs: number;
}

const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  multiplier: 2,
  jitter: 0.1, // 10% jitter
};

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number, config: FailoverConfig): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.multiplier, attempt);
  const delay = Math.min(baseDelay, config.maxDelayMs);

  // Add jitter (±10% by default)
  const jitterAmount = delay * config.jitter;
  const jitteredDelay = delay + (Math.random() * 2 - 1) * jitterAmount;

  return Math.max(0, Math.floor(jitteredDelay));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if HTTP status code indicates server error (5xx)
 */
function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

/**
 * Check if HTTP status code indicates client error (4xx)
 */
function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

/**
 * Authenticate request based on endpoint auth configuration
 */
async function authenticateRequest(
  endpoint: PrimarySourceEndpoint,
  requestInit: RequestInit
): Promise<RequestInit> {
  const { authType, authConfig } = endpoint;

  if (!authConfig) {
    return requestInit;
  }

  const headers = new Headers(requestInit.headers);

  switch (authType) {
    case 'API_KEY':
      if (authConfig.apiKey) {
        headers.set('X-API-Key', authConfig.apiKey);
      }
      break;

    case 'OAUTH2':
      if (authConfig.clientId && authConfig.clientSecret && authConfig.tokenUrl) {
        // Get OAuth2 token
        try {
          const tokenResponse = await fetch(authConfig.tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: authConfig.clientId,
              client_secret: authConfig.clientSecret,
            }),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            headers.set('Authorization', `Bearer ${tokenData.access_token}`);
          }
        } catch (error) {
          log.warn(`[PSV Failover] OAuth2 token fetch failed: ${error}`);
        }
      }
      break;

    case 'BASIC':
      if (authConfig.clientId && authConfig.clientSecret) {
        const credentials = Buffer.from(`${authConfig.clientId}:${authConfig.clientSecret}`).toString('base64');
        headers.set('Authorization', `Basic ${credentials}`);
      }
      break;

    case 'MTLS':
      // mTLS is handled at the transport layer
      break;

    case 'DPOP':
      // DPoP requires additional setup
      break;

    case 'NONE':
      // No authentication
      break;
  }

  return {
    ...requestInit,
    headers,
  };
}

/**
 * Execute verification request with retry logic
 */
async function executeWithRetry(
  endpoint: PrimarySourceEndpoint,
  requestPayload: any,
  config: FailoverConfig,
  attempt: number = 0
): Promise<{ success: boolean; response?: any; error?: string; status?: number }> {
  const startTime = Date.now();

  try {
    const requestInit: RequestInit = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add authentication
    const authenticatedRequest = await authenticateRequest(endpoint, requestInit);

    // Add request body for POST/PUT
    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      authenticatedRequest.body = JSON.stringify(requestPayload);
    }

    // Make request
    const response = await fetch(endpoint.endpoint, authenticatedRequest);
    const responseData = await response.json().catch(() => ({}));

    // Check if server error (5xx) - retryable
    if (isServerError(response.status)) {
      const error = `Server error: ${response.status} ${response.statusText}`;

      // Check if we should retry
      if (attempt < config.maxRetries) {
        const delay = calculateBackoffDelay(attempt, config);
        await sleep(delay);
        return executeWithRetry(endpoint, requestPayload, config, attempt + 1);
      }

      return {
        success: false,
        error,
        status: response.status,
      };
    }

    // Client errors (4xx) are not retryable
    if (isClientError(response.status)) {
      return {
        success: false,
        error: `Client error: ${response.status} ${response.statusText}`,
        status: response.status,
      };
    }

    // Success (2xx)
    if (response.ok) {
      return {
        success: true,
        response: responseData,
        status: response.status,
      };
    }

    // Other status codes
    return {
      success: false,
      error: `Unexpected status: ${response.status}`,
      status: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Network errors are retryable
    if (attempt < config.maxRetries) {
      const delay = calculateBackoffDelay(attempt, config);
      await sleep(delay);
      return executeWithRetry(endpoint, requestPayload, config, attempt + 1);
    }

    return {
      success: false,
      error: `Network error: ${errorMessage}`,
    };
  }
}

/**
 * B122A-PSV-009: Execute PSV verification with failover
 * Primary 5xx → fallback to next provider; exponential backoff; audit events stored
 */
export async function executePSVWithFailover(
  verificationType: VerificationType,
  subjectId: string,
  requestPayload: any,
  config: FailoverConfig = DEFAULT_FAILOVER_CONFIG
): Promise<FailoverResult> {
  const registry = getPSVRegistry();
  const startTime = Date.now();

  // Get all endpoints for this verification type, ordered by priority
  const endpoints = registry.listEndpoints({
    verificationType,
    active: true,
  });

  if (endpoints.length === 0) {
    return {
      success: false,
      endpointId: '',
      endpointName: '',
      provider: '',
      error: `No active endpoints found for verification type ${verificationType}`,
      attempts: [],
      totalDurationMs: Date.now() - startTime,
    };
  }

  // Order endpoints by provider priority: FCVS > NPDB > Nursys > NCCPA > others
  const providerPriority: Record<string, number> = {
    FCVS: 1,
    NPDB: 2,
    Nursys: 3,
    NCCPA: 4,
  };

  const sortedEndpoints = endpoints.sort((a, b) => {
    const priorityA = providerPriority[a.provider] || 999;
    const priorityB = providerPriority[b.provider] || 999;
    return priorityA - priorityB;
  });

  const attempts: RetryAttempt[] = [];

  // Try each endpoint in order
  for (const endpoint of sortedEndpoints) {
    const endpointStartTime = Date.now();
    let attemptCount = 0;

    // Execute with retry logic
    const result = await executeWithRetry(endpoint, requestPayload, config, 0);

    // Record attempts
    attempts.push({
      endpointId: endpoint.id,
      attempt: attemptCount++,
      delayMs: 0,
      timestamp: endpointStartTime,
      error: result.error,
    });

    // If successful, return result
    if (result.success) {
      const totalDurationMs = Date.now() - startTime;

      // Record successful verification in audit
      registry.recordVerification(
        endpoint.id,
        verificationType,
        subjectId,
        requestPayload,
        result.response,
        'success',
        totalDurationMs
      );

      return {
        success: true,
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        provider: endpoint.provider,
        response: result.response,
        attempts,
        totalDurationMs,
      };
    }

    // If server error (5xx), try next endpoint
    if (result.status && isServerError(result.status)) {
      log.warn(`[PSV Failover] Endpoint ${endpoint.name} (${endpoint.provider}) returned 5xx, trying next endpoint...`);

      // Record failed attempt in audit
      registry.recordVerification(
        endpoint.id,
        verificationType,
        subjectId,
        requestPayload,
        null,
        'failed',
        Date.now() - endpointStartTime
      );

      continue; // Try next endpoint
    }

    // Client errors (4xx) are not retryable - fail immediately
    if (result.status && isClientError(result.status)) {
      const totalDurationMs = Date.now() - startTime;

      // Record failed verification in audit
      registry.recordVerification(
        endpoint.id,
        verificationType,
        subjectId,
        requestPayload,
        null,
        'failed',
        totalDurationMs
      );

      return {
        success: false,
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        provider: endpoint.provider,
        error: result.error,
        attempts,
        totalDurationMs,
      };
    }
  }

  // All endpoints failed
  const totalDurationMs = Date.now() - startTime;

  // Record final failure in audit (use last endpoint attempted)
  const lastEndpoint = sortedEndpoints[sortedEndpoints.length - 1];
  registry.recordVerification(
    lastEndpoint.id,
    verificationType,
    subjectId,
    requestPayload,
    null,
    'failed',
    totalDurationMs
  );

  return {
    success: false,
    endpointId: lastEndpoint.id,
    endpointName: lastEndpoint.name,
    provider: lastEndpoint.provider,
    error: `All endpoints failed for verification type ${verificationType}`,
    attempts,
    totalDurationMs,
  };
}

/**
 * Get failover statistics
 */
export function getFailoverStatistics(): {
  totalAttempts: number;
  successfulFailovers: number;
  failedFailovers: number;
  averageRetries: number;
} {
  // In production, this would query from database
  // For now, return placeholder
  return {
    totalAttempts: 0,
    successfulFailovers: 0,
    failedFailovers: 0,
    averageRetries: 0,
  };
}

