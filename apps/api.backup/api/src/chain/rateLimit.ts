/**
 * Rate Limiting for Chain RPC Calls
 * Task 201.48 - Prevent runaway loops or DDoS-like behavior
 */

export class ChainRateLimiter {
  private callCounts: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxCalls: number;

  constructor(maxCalls: number = 100, windowMs: number = 60000) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }

  /**
   * Task 201.48 - Check if call is allowed
   */
  async checkLimit(key: string = 'global'): Promise<boolean> {
    const now = Date.now();
    const calls = this.callCounts.get(key) || [];

    // Remove calls outside the time window
    const recentCalls = calls.filter(timestamp => now - timestamp < this.windowMs);

    if (recentCalls.length >= this.maxCalls) {
      console.warn(`⚠️  Rate limit exceeded for ${key}: ${recentCalls.length}/${this.maxCalls} calls in ${this.windowMs}ms`);
      return false;
    }

    // Add current call
    recentCalls.push(now);
    this.callCounts.set(key, recentCalls);

    return true;
  }

  /**
   * Execute with rate limit check
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    fallback?: T
  ): Promise<T> {
    const allowed = await this.checkLimit(key);

    if (!allowed) {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new Error(`Rate limit exceeded for ${key}`);
    }

    return await fn();
  }

  /**
   * Reset rate limit for key
   */
  reset(key?: string): void {
    if (key) {
      this.callCounts.delete(key);
    } else {
      this.callCounts.clear();
    }
  }

  /**
   * Get current call count for key
   */
  getCallCount(key: string): number {
    const now = Date.now();
    const calls = this.callCounts.get(key) || [];
    return calls.filter(timestamp => now - timestamp < this.windowMs).length;
  }

  /**
   * Get remaining calls for key
   */
  getRemainingCalls(key: string): number {
    return Math.max(0, this.maxCalls - this.getCallCount(key));
  }
}

// Global rate limiter instance
export const globalChainRateLimiter = new ChainRateLimiter(100, 60000);

