/**
 * BackgroundSyncTaskScheduler
 *
 * Schedules background syncs at intervals or triggers on network availability:
 * - Uses OS APIs (stubbed) for background tasks
 * - Ensures battery-friendly operation
 * - Includes test scenarios
 */

export interface SyncSchedule {
  interval?: number; // milliseconds
  triggerOnNetwork?: boolean;
  triggerOnAppForeground?: boolean;
  minBatteryLevel?: number; // 0-100
}

export interface SyncTask {
  id: string;
  schedule: SyncSchedule;
  callback: () => Promise<void>;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
}

export interface NetworkStatus {
  online: boolean;
  type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

/**
 * Background sync task scheduler for mobile devices
 */
export class BackgroundSyncTaskScheduler {
  private tasks: Map<string, SyncTask> = new Map();
  private intervalId?: NodeJS.Timeout;
  private networkStatus: NetworkStatus = { online: true };
  private batteryLevel: number = 100;

  constructor() {
    this.setupNetworkListener();
    this.setupBatteryListener();
  }

  /**
   * Register a sync task
   */
  registerTask(task: Omit<SyncTask, 'lastRun' | 'nextRun'>): void {
    const fullTask: SyncTask = {
      ...task,
      enabled: task.enabled ?? true,
      nextRun: this.calculateNextRun(task.schedule),
    };

    this.tasks.set(task.id, fullTask);
    this.scheduleNextRun();
  }

  /**
   * Unregister a sync task
   */
  unregisterTask(taskId: string): void {
    this.tasks.delete(taskId);
  }

  /**
   * Enable/disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = enabled;
      if (enabled) {
        task.nextRun = this.calculateNextRun(task.schedule);
      }
    }
  }

  /**
   * Trigger a sync task immediately
   */
  async triggerTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled) {
      throw new Error(`Task ${taskId} not found or disabled`);
    }

    await this.executeTask(task);
  }

  /**
   * Trigger all enabled tasks
   */
  async triggerAll(): Promise<void> {
    const enabledTasks = Array.from(this.tasks.values()).filter(
      (t) => t.enabled,
    );

    await Promise.allSettled(
      enabledTasks.map((task) => this.executeTask(task)),
    );
  }

  /**
   * Get status of all tasks
   */
  getTaskStatus(): Array<{
    id: string;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
  }> {
    return Array.from(this.tasks.values()).map((task) => ({
      id: task.id,
      enabled: task.enabled,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
    }));
  }

  /**
   * Execute a sync task
   */
  private async executeTask(task: SyncTask): Promise<void> {
    // Check battery level
    if (
      task.schedule.minBatteryLevel !== undefined &&
      this.batteryLevel < task.schedule.minBatteryLevel
    ) {
      console.log(
        `Task ${task.id} skipped: battery level ${this.batteryLevel}% below minimum ${task.schedule.minBatteryLevel}%`,
      );
      return;
    }

    // Check network if required
    if (task.schedule.triggerOnNetwork && !this.networkStatus.online) {
      console.log(`Task ${task.id} skipped: network offline`);
      return;
    }

    try {
      await task.callback();
      task.lastRun = new Date();
      task.nextRun = this.calculateNextRun(task.schedule);
    } catch (error) {
      console.error(`Task ${task.id} failed:`, error);
      // Reschedule with exponential backoff
      task.nextRun = new Date(
        Date.now() + Math.min(300000, (task.lastRun ? Date.now() - task.lastRun.getTime() : 60000) * 2),
      );
    }
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(schedule: SyncSchedule): Date {
    if (schedule.interval) {
      return new Date(Date.now() + schedule.interval);
    }
    // If no interval, schedule for immediate execution
    return new Date();
  }

  /**
   * Schedule the next task execution
   */
  private scheduleNextRun(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const enabledTasks = Array.from(this.tasks.values()).filter(
      (t) => t.enabled && t.nextRun,
    );

    if (enabledTasks.length === 0) {
      return;
    }

    // Find the earliest next run
    const earliest = enabledTasks.reduce((earliest, task) => {
      if (!task.nextRun) return earliest;
      if (!earliest) return task;
      return task.nextRun < earliest.nextRun! ? task : earliest;
    }, enabledTasks[0]);

    if (!earliest || !earliest.nextRun) {
      return;
    }

    const delay = Math.max(0, earliest.nextRun.getTime() - Date.now());

    this.intervalId = setTimeout(() => {
      this.checkAndRunTasks();
      this.scheduleNextRun();
    }, delay);
  }

  /**
   * Check and run tasks that are due
   */
  private async checkAndRunTasks(): Promise<void> {
    const now = new Date();
    const dueTasks = Array.from(this.tasks.values()).filter(
      (task) =>
        task.enabled &&
        task.nextRun &&
        task.nextRun <= now &&
        this.canRunTask(task),
    );

    await Promise.allSettled(dueTasks.map((task) => this.executeTask(task)));
  }

  /**
   * Check if a task can run based on conditions
   */
  private canRunTask(task: SyncTask): boolean {
    // Check battery
    if (
      task.schedule.minBatteryLevel !== undefined &&
      this.batteryLevel < task.schedule.minBatteryLevel
    ) {
      return false;
    }

    // Check network
    if (task.schedule.triggerOnNetwork && !this.networkStatus.online) {
      return false;
    }

    return true;
  }

  /**
   * Setup network status listener (stubbed for Node.js)
   */
  private setupNetworkListener(): void {
    // In a real mobile app, this would use:
    // - navigator.onLine
    // - Network Information API
    // - OS-specific network change events

    // Stub: Simulate network status
    if (typeof window !== 'undefined' && 'navigator' in window) {
      this.networkStatus.online = navigator.onLine;

      window.addEventListener('online', () => {
        this.networkStatus.online = true;
        this.onNetworkAvailable();
      });

      window.addEventListener('offline', () => {
        this.networkStatus.online = false;
      });
    }
  }

  /**
   * Setup battery level listener (stubbed)
   */
  private setupBatteryListener(): void {
    // In a real mobile app, this would use:
    // - navigator.getBattery() (Chrome/Edge)
    // - Battery Status API (deprecated but still used)
    // - OS-specific battery APIs

    // Stub: Assume full battery
    if (
      typeof navigator !== 'undefined' &&
      'getBattery' in navigator &&
      typeof (navigator as any).getBattery === 'function'
    ) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          this.batteryLevel = battery.level * 100;
          battery.addEventListener('levelchange', () => {
            this.batteryLevel = battery.level * 100;
          });
        })
        .catch(() => {
          // Fallback: assume full battery
          this.batteryLevel = 100;
        });
    }
  }

  /**
   * Handle network becoming available
   */
  private onNetworkAvailable(): void {
    const networkTriggeredTasks = Array.from(this.tasks.values()).filter(
      (task) => task.enabled && task.schedule.triggerOnNetwork,
    );

    Promise.allSettled(
      networkTriggeredTasks.map((task) => this.executeTask(task)),
    );
  }

  /**
   * Handle app coming to foreground
   */
  onAppForeground(): void {
    const foregroundTasks = Array.from(this.tasks.values()).filter(
      (task) => task.enabled && task.schedule.triggerOnAppForeground,
    );

    Promise.allSettled(
      foregroundTasks.map((task) => this.executeTask(task)),
    );
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.tasks.clear();
  }
}

export const backgroundSyncTaskScheduler = new BackgroundSyncTaskScheduler();

