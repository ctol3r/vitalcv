/**
 * Challenge Storage Service
 *
 * Stores WebAuthn challenges temporarily with TTL.
 * In production, this should use Redis or similar distributed cache.
 */

interface ChallengeData {
  challenge: string;
  userId: string;
  type: 'registration' | 'authentication';
  expiresAt: Date;
}

class ChallengeStore {
  private challenges: Map<string, ChallengeData> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired challenges every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Store a challenge with TTL (default 5 minutes)
   */
  store(
    challengeId: string,
    challenge: string,
    userId: string,
    type: 'registration' | 'authentication',
    ttlSeconds: number = 300
  ): void {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    this.challenges.set(challengeId, {
      challenge,
      userId,
      type,
      expiresAt,
    });
  }

  /**
   * Retrieve and consume a challenge
   */
  retrieve(challengeId: string): ChallengeData | null {
    const data = this.challenges.get(challengeId);
    if (!data) {
      return null;
    }

    // Check if expired
    if (data.expiresAt < new Date()) {
      this.challenges.delete(challengeId);
      return null;
    }

    // Consume the challenge (one-time use)
    this.challenges.delete(challengeId);
    return data;
  }

  /**
   * Check if challenge exists without consuming it
   */
  exists(challengeId: string): boolean {
    const data = this.challenges.get(challengeId);
    if (!data) {
      return false;
    }

    if (data.expiresAt < new Date()) {
      this.challenges.delete(challengeId);
      return false;
    }

    return true;
  }

  /**
   * Remove a challenge
   */
  remove(challengeId: string): void {
    this.challenges.delete(challengeId);
  }

  /**
   * Clean up expired challenges
   */
  private cleanup(): void {
    const now = new Date();
    for (const [id, data] of this.challenges.entries()) {
      if (data.expiresAt < now) {
        this.challenges.delete(id);
      }
    }
  }

  /**
   * Clear all challenges (useful for testing)
   */
  clear(): void {
    this.challenges.clear();
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.challenges.clear();
  }
}

// Singleton instance
export const challengeStore = new ChallengeStore();

// Graceful shutdown
process.on('SIGTERM', () => {
  challengeStore.shutdown();
});

process.on('SIGINT', () => {
  challengeStore.shutdown();
});

