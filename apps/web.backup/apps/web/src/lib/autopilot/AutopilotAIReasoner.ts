/**
 * AutopilotAIReasoner
 * Ranks task importance using AI/ML logic
 */

import type { AutopilotTask } from './types';

export class AutopilotAIReasoner {
  /**
   * Rank tasks by importance
   * Uses priority, urgency, and contextual factors
   */
  rankImportance(tasks: AutopilotTask[]): AutopilotTask[] {
    // For now, sort by priority
    // In production, this would use ML models to consider:
    // - Task urgency (expiring credentials, stale anchors)
    // - User context (recent activity, trust score)
    // - Historical success rates
    // - Resource availability
    return tasks.sort((a, b) => {
      // Primary sort: priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Secondary sort: alphabetical by name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get the most important single task
   * Used for "Fix One Thing" feature
   */
  getMostImportantTask(tasks: AutopilotTask[]): AutopilotTask | null {
    const ranked = this.rankImportance(tasks);
    return ranked.length > 0 ? ranked[0] : null;
  }

  /**
   * Filter tasks that are actionable right now
   */
  getActionableTasks(tasks: AutopilotTask[]): AutopilotTask[] {
    // Filter out tasks that can't be executed now
    // This would check dependencies, prerequisites, etc.
    return tasks.filter((task) => {
      // For now, all tasks are actionable
      // In production, check:
      // - Dependencies met
      // - Prerequisites satisfied
      // - Not blocked by other tasks
      return true;
    });
  }
}

