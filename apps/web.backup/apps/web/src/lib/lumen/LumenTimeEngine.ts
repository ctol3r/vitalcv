/**
 * LumenTimeEngine
 * Chrono-based transformations and time-dependent visual effects
 */

export interface TimeTransformation {
  startTime: number;
  duration: number;
  progress: number; // 0.0 - 1.0
  easing: (t: number) => number;
}

export class LumenTimeEngine {
  private animations: Map<string, TimeTransformation> = new Map();
  private animationFrameId: number | null = null;
  private listeners: Map<string, Set<(progress: number) => void>> = new Map();

  /**
   * Start a time-based transformation
   */
  startTransformation(
    id: string,
    duration: number,
    easing: (t: number) => number = this.easeInOutCubic,
    onUpdate?: (progress: number) => void
  ): void {
    const transformation: TimeTransformation = {
      startTime: performance.now(),
      duration,
      progress: 0,
      easing,
    };

    this.animations.set(id, transformation);

    if (onUpdate) {
      if (!this.listeners.has(id)) {
        this.listeners.set(id, new Set());
      }
      this.listeners.get(id)!.add(onUpdate);
    }

    if (!this.animationFrameId) {
      this.tick();
    }
  }

  /**
   * Stop a transformation
   */
  stopTransformation(id: string): void {
    this.animations.delete(id);
    this.listeners.delete(id);

    if (this.animations.size === 0 && this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get current progress of a transformation
   */
  getProgress(id: string): number {
    const transformation = this.animations.get(id);
    if (!transformation) return 0;

    const elapsed = performance.now() - transformation.startTime;
    const rawProgress = Math.min(1, elapsed / transformation.duration);
    return transformation.easing(rawProgress);
  }

  /**
   * Main animation loop
   */
  private tick = (): void => {
    const now = performance.now();
    const toRemove: string[] = [];

    this.animations.forEach((transformation, id) => {
      const elapsed = now - transformation.startTime;
      const rawProgress = Math.min(1, elapsed / transformation.duration);
      const easedProgress = transformation.easing(rawProgress);

      transformation.progress = easedProgress;

      // Notify listeners
      const listeners = this.listeners.get(id);
      if (listeners) {
        listeners.forEach((callback) => {
          try {
            callback(easedProgress);
          } catch (error) {
            console.error(`[LumenTimeEngine] Error in listener:`, error);
          }
        });
      }

      if (rawProgress >= 1) {
        toRemove.push(id);
      }
    });

    // Clean up completed animations
    toRemove.forEach((id) => {
      this.stopTransformation(id);
    });

    if (this.animations.size > 0) {
      this.animationFrameId = requestAnimationFrame(this.tick);
    } else {
      this.animationFrameId = null;
    }
  };

  /**
   * Calculate expiration proximity (0.0 = expired, 1.0 = far from expiration)
   */
  calculateExpirationProximity(expiresAt: Date | null, now: Date = new Date()): number {
    if (!expiresAt) return 1.0;

    const totalDuration = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    if (timeUntilExpiry <= 0) return 0.0;
    if (timeUntilExpiry >= totalDuration) return 1.0;

    // Closer to expiration = lower proximity
    return timeUntilExpiry / totalDuration;
  }

  /**
   * Calculate recency score (0.0 = old, 1.0 = very recent)
   */
  calculateRecency(timestamp: Date, maxAgeDays: number = 365): number {
    const now = Date.now();
    const age = now - timestamp.getTime();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    if (age <= 0) return 1.0;
    if (age >= maxAge) return 0.0;

    // Exponential decay
    return Math.exp(-age / (maxAge / 2));
  }

  /**
   * Easing functions
   */
  easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  easeInCubic = (t: number): number => {
    return t * t * t;
  };

  easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  easeInOutQuad = (t: number): number => {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };

  linear = (t: number): number => t;

  /**
   * Format time remaining until expiration
   */
  formatTimeUntilExpiry(expiresAt: Date | null): string {
    if (!expiresAt) return 'No expiration';

    const now = new Date();
    const ms = expiresAt.getTime() - now.getTime();

    if (ms <= 0) return 'Expired';

    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return '< 1h';
  }
}

