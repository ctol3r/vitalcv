/**
 * AutopilotEngine
 * Core coordinating engine for VitalCV Autopilot Mode
 */

import { AutopilotScheduler } from './AutopilotScheduler';
import { AutopilotTaskRegistry } from './AutopilotTaskRegistry';
import { AutopilotAIReasoner } from './AutopilotAIReasoner';
import { AutopilotChainBridge } from './AutopilotChainBridge';
import type {
  AutopilotStatus,
  AutopilotIssue,
  AutopilotTask,
  AutopilotConfig,
  AutopilotHealthSummary,
} from './types';

export class AutopilotEngine {
  // Published state
  private _status: AutopilotStatus = AutopilotStatus.Idle;
  private _lastRun: Date | null = null;
  private _pendingIssues: AutopilotIssue[] = [];
  private _completedTasks: number = 0;

  // Engine components
  private scheduler: AutopilotScheduler;
  private taskRegistry: AutopilotTaskRegistry;
  private aiReasoner: AutopilotAIReasoner;
  private chainBridge: AutopilotChainBridge;

  // State listeners
  private statusListeners: Set<(status: AutopilotStatus) => void> = new Set();
  private issueListeners: Set<(issues: AutopilotIssue[]) => void> = new Set();

  constructor(config: AutopilotConfig) {
    this.scheduler = new AutopilotScheduler(config);
    this.taskRegistry = new AutopilotTaskRegistry();
    this.aiReasoner = new AutopilotAIReasoner();
    this.chainBridge = new AutopilotChainBridge();
  }

  /**
   * Get current status
   */
  get status(): AutopilotStatus {
    return this._status;
  }

  /**
   * Get last run timestamp
   */
  get lastRun(): Date | null {
    return this._lastRun;
  }

  /**
   * Get pending issues
   */
  get pendingIssues(): AutopilotIssue[] {
    return [...this._pendingIssues];
  }

  /**
   * Get completed tasks count
   */
  get completedTasks(): number {
    return this._completedTasks;
  }

  /**
   * Register a task
   */
  registerTask(task: AutopilotTask): void {
    this.taskRegistry.registerTask(task);
  }

  /**
   * Start autopilot cycle
   * User taps the orb or autopilot triggers automatically
   */
  async run(): Promise<void> {
    if (this._status === AutopilotStatus.Running) {
      console.warn('[AutopilotEngine] Already running, skipping');
      return;
    }

    this._status = AutopilotStatus.Running;
    this.notifyStatusChange();

    try {
      // 1. Ask AI which tasks matter most
      const allTasks = this.taskRegistry.getAllTasks();
      const importantTasks = this.aiReasoner.rankImportance(allTasks);

      // 2. Execute them in priority order
      this._completedTasks = 0;
      for (const task of importantTasks) {
        try {
          await task.execute();
          this._completedTasks++;
        } catch (error) {
          const issue: AutopilotIssue = {
            id: `${task.id}-${Date.now()}`,
            task: task.name,
            error: error instanceof Error ? error : new Error(String(error)),
            timestamp: new Date(),
            isCritical: task.priority >= 80,
          };
          this._pendingIssues.push(issue);
          this.notifyIssuesChange();
        }
      }

      // 3. Chain sync after tasks complete
      await this.chainBridge.refreshAnchorsIfNeeded();

      this._lastRun = new Date();
      this.scheduler.markRun();
      this._status = this._pendingIssues.length === 0
        ? AutopilotStatus.Ready
        : AutopilotStatus.AttentionNeeded;
    } catch (error) {
      console.error('[AutopilotEngine] Fatal error during run:', error);
      this._status = AutopilotStatus.AttentionNeeded;
      const issue: AutopilotIssue = {
        id: `engine-${Date.now()}`,
        task: 'AutopilotEngine.run',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
        isCritical: true,
      };
      this._pendingIssues.push(issue);
      this.notifyIssuesChange();
    } finally {
      this.notifyStatusChange();
    }
  }

  /**
   * Check if autopilot should run automatically
   */
  shouldRun(): boolean {
    return this.scheduler.shouldRun();
  }

  /**
   * Get health summary
   */
  getHealthSummary(): AutopilotHealthSummary {
    return {
      status: this._status,
      lastRun: this._lastRun,
      pendingIssues: this._pendingIssues.length,
      totalTasks: this.taskRegistry.getTaskCount(),
      completedTasks: this._completedTasks,
      confidence: this.calculateConfidence(),
    };
  }

  /**
   * Get the most important single task
   * Used for "Fix One Thing" feature
   */
  getMostImportantTask(): AutopilotTask | null {
    const allTasks = this.taskRegistry.getAllTasks();
    return this.aiReasoner.getMostImportantTask(allTasks);
  }

  /**
   * Clear pending issues
   */
  clearIssues(): void {
    this._pendingIssues = [];
    this.notifyIssuesChange();
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: AutopilotStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Subscribe to issue changes
   */
  onIssuesChange(callback: (issues: AutopilotIssue[]) => void): () => void {
    this.issueListeners.add(callback);
    return () => {
      this.issueListeners.delete(callback);
    };
  }

  /**
   * Calculate confidence score (0-100)
   */
  private calculateConfidence(): number {
    const totalTasks = this.taskRegistry.getTaskCount();
    if (totalTasks === 0) return 100;

    const successRate = this._completedTasks / totalTasks;
    const issuePenalty = this._pendingIssues.length * 10;
    const confidence = Math.max(0, Math.min(100, successRate * 100 - issuePenalty));

    return Math.round(confidence);
  }

  /**
   * Notify status change listeners
   */
  private notifyStatusChange(): void {
    this.statusListeners.forEach((callback) => {
      try {
        callback(this._status);
      } catch (error) {
        console.error('[AutopilotEngine] Error in status listener:', error);
      }
    });
  }

  /**
   * Notify issue change listeners
   */
  private notifyIssuesChange(): void {
    this.issueListeners.forEach((callback) => {
      try {
        callback(this.pendingIssues);
      } catch (error) {
        console.error('[AutopilotEngine] Error in issue listener:', error);
      }
    });
  }
}

