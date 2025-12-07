const log = getServiceLogger('psv/resolvers/provider-type-resolver-enhanced');
/**
 * B127A-PSV-009: Provider-type resolvers with failover/backoff
 *
 * Resolvers for:
 * - FCVS (Federation of State Medical Boards)
 * - NPDB (National Practitioner Data Bank)
 * - Nursys (National Nursing Database)
 * - NCCPA (National Commission on Certification of Physician Assistants)
 *
 * Features:
 * - Primary 5xx → fallback
 * - Exponential retry with backoff
 * - Audit events
 * - Circuit breaker pattern
 */

import { EventEmitter } from 'events';
import { getServiceLogger } from '../../logging/serviceLogger';

export type ProviderType = 'FCVS' | 'NPDB' | 'Nursys' | 'NCCPA';

export interface ProviderVerificationRequest {
  providerType: ProviderType;
  providerIdentifier: string; // License number, NPI, etc.
  state?: string;
  additionalData?: Record<string, any>;
}

export interface ProviderVerificationResponse {
  verified: boolean;
  providerType: ProviderType;
  providerIdentifier: string;
  status: 'active' | 'inactive' | 'suspended' | 'revoked' | 'unknown';
  details?: Record<string, any>;
  source: 'primary' | 'fallback';
  timestamp: string;
  error?: string;
}

export interface ResolverConfig {
  primaryUrl: string;
  fallbackUrl?: string;
  timeout: number;
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  circuitBreakerThreshold: number; // Number of failures before opening circuit
  circuitBreakerTimeout: number; // Time to wait before attempting to close circuit
}

const DEFAULT_CONFIG: Omit<ResolverConfig, 'primaryUrl' | 'fallbackUrl'> = {
  timeout: 5000, // 5 seconds
  maxRetries: 3,
  initialBackoffMs: 1000, // 1 second
  maxBackoffMs: 32000, // 32 seconds
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000, // 1 minute
};

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit breaker for provider service
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private threshold: number,
    private timeout: number
  ) {}

  canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}

/**
 * Audit event emitter for provider verification events
 */
export const providerAuditEvents = new EventEmitter();

/**
 * Emit audit event
 */
function emitAudit(event: string, data: Record<string, any>): void {
  const auditEntry = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };

  providerAuditEvents.emit('audit', auditEntry);
  log.info(`[PSV AUDIT] ${event}`, auditEntry);
}

/**
 * Provider Type Resolver with failover and exponential backoff
 */
export class ProviderTypeResolver {
  private config: ResolverConfig;
  private primaryCircuitBreaker: CircuitBreaker;
  private fallbackCircuitBreaker?: CircuitBreaker;

  constructor(
    private providerType: ProviderType,
    config: Partial<ResolverConfig> & Pick<ResolverConfig, 'primaryUrl'>
  ) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.primaryCircuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerTimeout
    );

    if (this.config.fallbackUrl) {
      this.fallbackCircuitBreaker = new CircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerTimeout
      );
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const delay = Math.min(
      this.config.initialBackoffMs * Math.pow(2, attempt),
      this.config.maxBackoffMs
    );
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.round(delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with timeout
   */
  private async makeRequest(
    url: string,
    request: ProviderVerificationRequest,
    source: 'primary' | 'fallback'
  ): Promise<ProviderVerificationResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        ...data,
        source,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Attempt verification with retry logic
   */
  private async attemptVerification(
    url: string,
    request: ProviderVerificationRequest,
    source: 'primary' | 'fallback',
    circuitBreaker: CircuitBreaker
  ): Promise<ProviderVerificationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      // Check circuit breaker
      if (!circuitBreaker.canAttempt()) {
        emitAudit('CIRCUIT_BREAKER_OPEN', {
          providerType: this.providerType,
          source,
          state: circuitBreaker.getState(),
        });
        throw new Error(`Circuit breaker OPEN for ${source}`);
      }

      try {
        const response = await this.makeRequest(url, request, source);

        // Success - record in circuit breaker
        circuitBreaker.recordSuccess();

        emitAudit('VERIFICATION_SUCCESS', {
          providerType: this.providerType,
          providerIdentifier: request.providerIdentifier,
          source,
          attempt: attempt + 1,
          verified: response.verified,
        });

        return response;
      } catch (error) {
        lastError = error as Error;
        const isServerError = lastError.message.includes('5');
        const is429 = lastError.message.includes('429');

        // Record failure in circuit breaker
        circuitBreaker.recordFailure();

        emitAudit('VERIFICATION_ATTEMPT_FAILED', {
          providerType: this.providerType,
          providerIdentifier: request.providerIdentifier,
          source,
          attempt: attempt + 1,
          error: lastError.message,
          isServerError,
          is429,
          circuitState: circuitBreaker.getState(),
        });

        // Don't retry on client errors (4xx except 429)
        if (!isServerError && !is429) {
          break;
        }

        // If not last attempt, backoff
        if (attempt < this.config.maxRetries - 1) {
          const backoffMs = this.calculateBackoff(attempt);

          emitAudit('EXPONENTIAL_BACKOFF', {
            providerType: this.providerType,
            source,
            attempt: attempt + 1,
            backoffMs,
          });

          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new Error('Verification failed after all retries');
  }

  /**
   * Verify provider with automatic failover
   * B127A-PSV-009: Primary 5xx → fallback; exponential retry; audit events
   */
  async verify(request: ProviderVerificationRequest): Promise<ProviderVerificationResponse> {
    const startTime = Date.now();

    emitAudit('VERIFICATION_STARTED', {
      providerType: this.providerType,
      providerIdentifier: request.providerIdentifier,
      state: request.state,
    });

    try {
      // Try primary first
      const response = await this.attemptVerification(
        this.config.primaryUrl,
        request,
        'primary',
        this.primaryCircuitBreaker
      );

      const duration = Date.now() - startTime;

      emitAudit('VERIFICATION_COMPLETED', {
        providerType: this.providerType,
        providerIdentifier: request.providerIdentifier,
        source: 'primary',
        verified: response.verified,
        durationMs: duration,
      });

      return response;
    } catch (primaryError) {
      emitAudit('PRIMARY_FAILED', {
        providerType: this.providerType,
        providerIdentifier: request.providerIdentifier,
        error: (primaryError as Error).message,
      });

      // Try fallback if configured
      if (this.config.fallbackUrl && this.fallbackCircuitBreaker) {
        try {
          emitAudit('FAILOVER_TO_FALLBACK', {
            providerType: this.providerType,
            providerIdentifier: request.providerIdentifier,
          });

          const response = await this.attemptVerification(
            this.config.fallbackUrl,
            request,
            'fallback',
            this.fallbackCircuitBreaker
          );

          const duration = Date.now() - startTime;

          emitAudit('VERIFICATION_COMPLETED', {
            providerType: this.providerType,
            providerIdentifier: request.providerIdentifier,
            source: 'fallback',
            verified: response.verified,
            durationMs: duration,
          });

          return response;
        } catch (fallbackError) {
          emitAudit('FALLBACK_FAILED', {
            providerType: this.providerType,
            providerIdentifier: request.providerIdentifier,
            primaryError: (primaryError as Error).message,
            fallbackError: (fallbackError as Error).message,
          });

          throw new Error(
            `Both primary and fallback verification failed. Primary: ${(primaryError as Error).message}, Fallback: ${(fallbackError as Error).message}`
          );
        }
      }

      // No fallback configured
      throw primaryError;
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): {
    providerType: ProviderType;
    primaryCircuitState: CircuitState;
    fallbackCircuitState?: CircuitState;
  } {
    return {
      providerType: this.providerType,
      primaryCircuitState: this.primaryCircuitBreaker.getState(),
      fallbackCircuitState: this.fallbackCircuitBreaker?.getState(),
    };
  }

  /**
   * Reset circuit breakers
   */
  reset(): void {
    this.primaryCircuitBreaker.reset();
    this.fallbackCircuitBreaker?.reset();
  }
}

/**
 * B127A-PSV-009: Pre-configured resolvers for each provider type
 */
export const FCVS_RESOLVER = new ProviderTypeResolver('FCVS', {
  primaryUrl: process.env.FCVS_PRIMARY_URL || 'https://api.fsmb.org/fcvs/verify',
  fallbackUrl: process.env.FCVS_FALLBACK_URL || 'https://backup.fsmb.org/fcvs/verify',
});

export const NPDB_RESOLVER = new ProviderTypeResolver('NPDB', {
  primaryUrl: process.env.NPDB_PRIMARY_URL || 'https://www.npdb.hrsa.gov/api/verify',
  fallbackUrl: process.env.NPDB_FALLBACK_URL,
});

export const NURSYS_RESOLVER = new ProviderTypeResolver('Nursys', {
  primaryUrl: process.env.NURSYS_PRIMARY_URL || 'https://www.nursys.com/api/verify',
  fallbackUrl: process.env.NURSYS_FALLBACK_URL,
});

export const NCCPA_RESOLVER = new ProviderTypeResolver('NCCPA', {
  primaryUrl: process.env.NCCPA_PRIMARY_URL || 'https://prodcmsstorage.blob.core.windows.net/public-files/verify',
  fallbackUrl: process.env.NCCPA_FALLBACK_URL,
});

/**
 * Unified resolver interface
 */
export async function verifyProvider(
  request: ProviderVerificationRequest
): Promise<ProviderVerificationResponse> {
  const resolver = {
    FCVS: FCVS_RESOLVER,
    NPDB: NPDB_RESOLVER,
    Nursys: NURSYS_RESOLVER,
    NCCPA: NCCPA_RESOLVER,
  }[request.providerType];

  if (!resolver) {
    throw new Error(`Unknown provider type: ${request.providerType}`);
  }

  return resolver.verify(request);
}

/**
 * Get status of all resolvers
 */
export function getAllResolverStatus(): Record<ProviderType, ReturnType<ProviderTypeResolver['getStatus']>> {
  return {
    FCVS: FCVS_RESOLVER.getStatus(),
    NPDB: NPDB_RESOLVER.getStatus(),
    Nursys: NURSYS_RESOLVER.getStatus(),
    NCCPA: NCCPA_RESOLVER.getStatus(),
  };
}

