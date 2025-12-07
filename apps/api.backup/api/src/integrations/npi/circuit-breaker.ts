/**
 * Circuit Breaker for NPI Integration
 * Tagged: cursor-batch-1107 (Task 0007)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Implements circuit breaker pattern and exponential backoff
 * for resilience against NPPES API outages
 */

import { log } from '../../lib/logging';
import { Counter, Gauge } from 'prom-client';

// ============================================================================
// PROMETHEUS METRICS
// ============================================================================

const npiRequestCounter = new Counter({
  name: 'npi_requests_total',
  help: 'Total NPI API requests',
  labelNames: ['outcome'], // success, failure, circuit_open, timeout
});

const npiCircuitStateGauge = new Gauge({
  name: 'npi_circuit_breaker_state',
  help: 'NPI circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['state'],
});

const npiErrorCounter = new Counter({
  name: 'npi_errors_total',
  help: 'Total NPI API errors by type',
  labelNames: ['error_type'], // timeout, 5xx, network, parse, etc.
});

// ============================================================================
// CIRCUIT BREAKER STATE
// ============================================================================

enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failures exceeded threshold, rejecting requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Number of successes in half-open before closing
  timeout: number;               // Request timeout in ms
  resetTimeout: number;          // Time to wait before half-open in ms
  volumeThreshold: number;       // Minimum requests before evaluating failure rate
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,           // Open after 5 failures
  successThreshold: 2,           // Close after 2 successes in half-open
  timeout: 5000,                 // 5 second timeout
  resetTimeout: 60000,           // 1 minute cooldown
  volumeThreshold: 10,           // Need at least 10 requests to evaluate
};

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private requestCount: number = 0;

  constructor(private config: CircuitBreakerConfig = DEFAULT_CONFIG) {
    this.updateMetrics();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, context?: Record<string, any>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if we should transition to half-open
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        log.info('Circuit breaker transitioning to half-open', context);
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        this.updateMetrics();
      } else {
        npiRequestCounter.inc({ outcome: 'circuit_open' });
        throw new Error('Circuit breaker is OPEN - NPI service unavailable');
      }
    }

    this.requestCount++;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, this.config.timeout);

      // Record success
      this.onSuccess(context);

      return result;
    } catch (error: any) {
      // Record failure
      this.onFailure(error, context);

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  }

  /**
   * Handle successful request
   */
  private onSuccess(context?: Record<string, any>): void {
    this.failureCount = 0;
    npiRequestCounter.inc({ outcome: 'success' });

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        log.info('Circuit breaker closing after successful recovery', {
          ...context,
          successCount: this.successCount,
        });
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.requestCount = 0;
        this.updateMetrics();
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(error: Error, context?: Record<string, any>): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Categorize error
    const errorType = this.categorizeError(error);
    npiErrorCounter.inc({ error_type: errorType });
    npiRequestCounter.inc({ outcome: 'failure' });

    log.warn('NPI request failed', {
      ...context,
      error: error.message,
      errorType,
      failureCount: this.failureCount,
      state: this.state,
    });

    // Check if we should open the circuit
    if (
      this.state === CircuitState.HALF_OPEN ||
      (this.requestCount >= this.config.volumeThreshold &&
        this.failureCount >= this.config.failureThreshold)
    ) {
      log.error('Circuit breaker opening due to failures', {
        ...context,
        failureCount: this.failureCount,
        requestCount: this.requestCount,
        threshold: this.config.failureThreshold,
      });
      this.state = CircuitState.OPEN;
      this.updateMetrics();
    }
  }

  /**
   * Categorize error for metrics
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network';
    if (message.includes('5')) return '5xx';
    if (message.includes('4')) return '4xx';
    if (message.includes('parse')) return 'parse';

    return 'unknown';
  }

  /**
   * Update Prometheus metrics
   */
  private updateMetrics(): void {
    const stateValue = this.state === CircuitState.CLOSED ? 0 :
                       this.state === CircuitState.OPEN ? 1 : 2;

    npiCircuitStateGauge.set({ state: this.state }, stateValue);
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Manually reset circuit (for testing/admin)
   */
  reset(): void {
    log.info('Circuit breaker manually reset');
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.updateMetrics();
  }
}

// ============================================================================
// EXPONENTIAL BACKOFF
// ============================================================================

interface BackoffConfig {
  initialDelay: number;    // Initial delay in ms
  maxDelay: number;        // Maximum delay in ms
  multiplier: number;      // Backoff multiplier
  maxRetries: number;      // Maximum retry attempts
  jitter: boolean;         // Add random jitter to delays
}

const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelay: 1000,      // Start with 1 second
  maxDelay: 32000,         // Max 32 seconds
  multiplier: 2,           // Double each time
  maxRetries: 5,           // Max 5 retries
  jitter: true,            // Add jitter
};

/**
 * Execute function with exponential backoff retry
 */
export async function executeWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<BackoffConfig> = {},
): Promise<T> {
  const fullConfig = { ...DEFAULT_BACKOFF_CONFIG, ...config };
  let lastError: Error;
  let delay = fullConfig.initialDelay;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === fullConfig.maxRetries) {
        log.error('Max retries exceeded', {
          attempt,
          maxRetries: fullConfig.maxRetries,
          error: error.message,
        });
        break;
      }

      // Calculate delay with optional jitter
      let actualDelay = Math.min(delay, fullConfig.maxDelay);
      if (fullConfig.jitter) {
        actualDelay = actualDelay * (0.5 + Math.random() * 0.5); // ±50% jitter
      }

      log.warn('Request failed, retrying with backoff', {
        attempt,
        delay: actualDelay,
        error: error.message,
      });

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, actualDelay));

      // Increase delay for next attempt
      delay *= fullConfig.multiplier;
    }
  }

  throw lastError!;
}

// ============================================================================
// SINGLETON CIRCUIT BREAKER
// ============================================================================

export const npiCircuitBreaker = new CircuitBreaker(DEFAULT_CONFIG);

/**
 * Execute NPI request with circuit breaker and backoff
 */
export async function executeNpiRequest<T>(
  fn: () => Promise<T>,
  context?: Record<string, any>,
): Promise<T> {
  return npiCircuitBreaker.execute(
    () => executeWithBackoff(fn, DEFAULT_BACKOFF_CONFIG),
    context,
  );
}

export { CircuitBreaker, CircuitState };

