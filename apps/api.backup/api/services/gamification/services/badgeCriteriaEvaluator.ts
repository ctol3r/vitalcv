/**
 * BadgeCriteriaEvaluator
 * B247B-GAM-014: Evaluates user activity against badge criteria; supports criteria types such as point thresholds, action counts, continuous streaks; returns true if criteria met; includes unit tests for diverse criteria
 */

import { BadgeCriteria, ProgressData } from '../models/Badge';

export interface UserActivity {
  points?: number;
  actionCounts?: Record<string, number>;
  streaks?: Record<string, number>;
  lastActionDates?: Record<string, string>;
  metadata?: Record<string, any>;
}

export class BadgeCriteriaEvaluator {
  /**
   * Evaluate if user activity meets badge criteria
   */
  evaluate(criteria: BadgeCriteria, activity: UserActivity, progress: ProgressData): boolean {
    switch (criteria.type) {
      case 'point_threshold':
        return this.evaluatePointThreshold(criteria, activity, progress);

      case 'action_count':
        return this.evaluateActionCount(criteria, activity, progress);

      case 'streak':
        return this.evaluateStreak(criteria, activity, progress);

      case 'composite':
        return this.evaluateComposite(criteria, activity, progress);

      default:
        throw new Error(`Unknown criteria type: ${(criteria as any).type}`);
    }
  }

  /**
   * Evaluate point threshold criteria
   */
  private evaluatePointThreshold(
    criteria: BadgeCriteria,
    activity: UserActivity,
    progress: ProgressData
  ): boolean {
    const threshold = criteria.value || 0;
    const currentPoints = progress.points || activity.points || 0;
    return currentPoints >= threshold;
  }

  /**
   * Evaluate action count criteria
   */
  private evaluateActionCount(
    criteria: BadgeCriteria,
    activity: UserActivity,
    progress: ProgressData
  ): boolean {
    if (!criteria.action) {
      return false;
    }

    const requiredCount = criteria.value || 0;
    const actionCount = progress.actionCount || activity.actionCounts?.[criteria.action] || 0;
    return actionCount >= requiredCount;
  }

  /**
   * Evaluate streak criteria
   */
  private evaluateStreak(
    criteria: BadgeCriteria,
    activity: UserActivity,
    progress: ProgressData
  ): boolean {
    const requiredDays = criteria.days || 0;
    const currentStreak = progress.streakDays || activity.streaks?.['default'] || 0;
    return currentStreak >= requiredDays;
  }

  /**
   * Evaluate composite criteria (AND/OR logic)
   */
  private evaluateComposite(
    criteria: BadgeCriteria,
    activity: UserActivity,
    progress: ProgressData
  ): boolean {
    if (!criteria.conditions || criteria.conditions.length === 0) {
      return false;
    }

    const results = criteria.conditions.map((condition) =>
      this.evaluate(condition, activity, progress)
    );

    if (criteria.operator === 'OR') {
      return results.some((result) => result === true);
    } else {
      // Default to AND
      return results.every((result) => result === true);
    }
  }

  /**
   * Calculate progress percentage towards criteria
   */
  calculateProgress(criteria: BadgeCriteria, activity: UserActivity, progress: ProgressData): number {
    switch (criteria.type) {
      case 'point_threshold':
        const threshold = criteria.value || 1;
        const currentPoints = progress.points || activity.points || 0;
        return Math.min(100, Math.round((currentPoints / threshold) * 100));

      case 'action_count':
        if (!criteria.action) {
          return 0;
        }
        const requiredCount = criteria.value || 1;
        const actionCount = progress.actionCount || activity.actionCounts?.[criteria.action] || 0;
        return Math.min(100, Math.round((actionCount / requiredCount) * 100));

      case 'streak':
        const requiredDays = criteria.days || 1;
        const currentStreak = progress.streakDays || activity.streaks?.['default'] || 0;
        return Math.min(100, Math.round((currentStreak / requiredDays) * 100));

      case 'composite':
        // For composite, calculate average progress of all conditions
        if (!criteria.conditions || criteria.conditions.length === 0) {
          return 0;
        }
        const progresses = criteria.conditions.map((condition) =>
          this.calculateProgress(condition, activity, progress)
        );
        const sum = progresses.reduce((acc, p) => acc + p, 0);
        return Math.round(sum / progresses.length);

      default:
        return 0;
    }
  }

  /**
   * Update progress data based on activity
   */
  updateProgress(
    criteria: BadgeCriteria,
    currentProgress: ProgressData,
    activity: UserActivity
  ): ProgressData {
    const updated: ProgressData = { ...currentProgress };

    switch (criteria.type) {
      case 'point_threshold':
        if (activity.points !== undefined) {
          updated.points = (updated.points || 0) + activity.points;
        }
        break;

      case 'action_count':
        if (criteria.action && activity.actionCounts?.[criteria.action] !== undefined) {
          updated.actionCount = (updated.actionCount || 0) + activity.actionCounts[criteria.action];
        }
        break;

      case 'streak':
        if (activity.streaks?.['default'] !== undefined) {
          updated.streakDays = activity.streaks['default'];
        }
        if (activity.lastActionDates?.['default']) {
          updated.lastActionDate = activity.lastActionDates['default'];
        }
        break;

      case 'composite':
        // For composite, update progress for all conditions
        if (criteria.conditions) {
          for (const condition of criteria.conditions) {
            this.updateProgress(condition, updated, activity);
          }
        }
        break;
    }

    // Merge metadata
    if (activity.metadata) {
      updated.metadata = { ...(updated.metadata || {}), ...activity.metadata };
    }

    return updated;
  }
}

