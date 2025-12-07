/**
 * AutopilotScheduler
 * Determines when autopilot should run based on various triggers
 */

import type { AutopilotConfig } from './types';

export class AutopilotScheduler {
  private config: AutopilotConfig;
  private lastRun: Date | null = null;
  private trustScore: number = 100;
  private appLaunchTime: Date | null = null;

  constructor(config: AutopilotConfig) {
    this.config = config;
    this.appLaunchTime = new Date();
  }

  /**
   * Check if autopilot should run
   */
  shouldRun(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Run on app launch
    if (this.appLaunchTime && this.isRecentLaunch()) {
      return true;
    }

    // Run if trust score dropped significantly
    if (this.trustScore < 70) {
      return true;
    }

    // Run if last run was more than configured interval ago
    if (this.lastRun) {
      const hoursSinceLastRun =
        (Date.now() - this.lastRun.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun >= this.config.trustCheckIntervalHours) {
        return true;
      }
    } else {
      // Never run before - run now
      return true;
    }

    return false;
  }

  /**
   * Update last run timestamp
   */
  markRun(): void {
    this.lastRun = new Date();
  }

  /**
   * Update trust score for scheduling decisions
   */
  updateTrustScore(score: number): void {
    this.trustScore = score;
  }

  /**
   * Check if app was recently launched (within last 5 minutes)
   */
  private isRecentLaunch(): boolean {
    if (!this.appLaunchTime) return false;
    const minutesSinceLaunch =
      (Date.now() - this.appLaunchTime.getTime()) / (1000 * 60);
    return minutesSinceLaunch < 5;
  }

  /**
   * Get time until next scheduled run
   */
  getTimeUntilNextRun(): number | null {
    if (!this.lastRun) return 0;

    const hoursSinceLastRun =
      (Date.now() - this.lastRun.getTime()) / (1000 * 60 * 60);
    const hoursUntilNext =
      this.config.trustCheckIntervalHours - hoursSinceLastRun;

    return hoursUntilNext > 0 ? Math.ceil(hoursUntilNext) : 0;
  }
}

