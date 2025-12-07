/**
 * AutopilotTaskRegistry
 * Manages all available autopilot tasks
 */

import type { AutopilotTask } from './types';

export class AutopilotTaskRegistry {
  private tasks: Map<string, AutopilotTask> = new Map();

  /**
   * Register a new task
   */
  registerTask(task: AutopilotTask): void {
    this.tasks.set(task.id, task);
  }

  /**
   * Get all registered tasks
   */
  getAllTasks(): AutopilotTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): AutopilotTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get tasks by category
   */
  getTasksByCategory(category: string): AutopilotTask[] {
    return this.getAllTasks().filter((task) => task.category === category);
  }

  /**
   * Get tasks sorted by priority
   */
  getTasksByPriority(): AutopilotTask[] {
    return this.getAllTasks().sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
  }

  /**
   * Get task count
   */
  getTaskCount(): number {
    return this.tasks.size;
  }
}

