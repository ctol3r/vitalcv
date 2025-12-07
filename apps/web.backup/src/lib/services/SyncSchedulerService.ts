/**
 * SyncSchedulerService
 * Manages sync queue and scheduling for offline data synchronization
 * Tracks pending items, last sync time, and errors
 */

export interface SyncItem {
  id: string;
  type: 'form' | 'action' | 'data';
  data: unknown;
  timestamp: number;
  retries: number;
}

export interface SyncStatus {
  pendingCount: number;
  lastSyncTime: Date | null;
  hasError: boolean;
  errorMessage?: string;
}

class SyncSchedulerService {
  private queue: SyncItem[] = [];
  private lastSyncTime: Date | null = null;
  private hasError: boolean = false;
  private errorMessage?: string;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private syncInProgress: boolean = false;
  private maxRetries = 3;

  constructor() {
    if (typeof window === 'undefined') return;

    // Load queue from localStorage
    this.loadQueue();

    // Auto-sync when online
    window.addEventListener('online', this.handleOnline);

    // Start periodic sync check
    this.startPeriodicSync();
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem('vitalcv-sync-queue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
      const lastSync = localStorage.getItem('vitalcv-last-sync');
      if (lastSync) {
        this.lastSyncTime = new Date(parseInt(lastSync));
      }
    } catch (error) {
      console.warn('Failed to load sync queue:', error);
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem('vitalcv-sync-queue', JSON.stringify(this.queue));
      if (this.lastSyncTime) {
        localStorage.setItem('vitalcv-last-sync', this.lastSyncTime.getTime().toString());
      }
    } catch (error) {
      console.warn('Failed to save sync queue:', error);
    }
  }

  private handleOnline = () => {
    if (this.queue.length > 0 && !this.syncInProgress) {
      this.sync();
    }
  };

  private startPeriodicSync() {
    // Check every 30 seconds if online and queue has items
    setInterval(() => {
      if (navigator.onLine && this.queue.length > 0 && !this.syncInProgress) {
        this.sync();
      }
    }, 30000);
  }

  addToQueue(item: Omit<SyncItem, 'id' | 'timestamp' | 'retries'>): string {
    const syncItem: SyncItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(syncItem);
    this.saveQueue();
    this.notifyListeners();

    // Auto-sync if online
    if (navigator.onLine && !this.syncInProgress) {
      this.sync();
    }

    return syncItem.id;
  }

  async sync(): Promise<void> {
    if (this.syncInProgress || this.queue.length === 0 || !navigator.onLine) {
      return;
    }

    this.syncInProgress = true;
    this.hasError = false;
    this.errorMessage = undefined;
    this.notifyListeners();

    const itemsToSync = [...this.queue];
    const failedItems: SyncItem[] = [];

    for (const item of itemsToSync) {
      try {
        // Attempt to sync item (this would call your actual API)
        await this.syncItem(item);
        // Remove from queue on success
        this.queue = this.queue.filter((q) => q.id !== item.id);
      } catch (error) {
        item.retries += 1;
        if (item.retries < this.maxRetries) {
          failedItems.push(item);
        } else {
          // Max retries reached, remove from queue
          this.queue = this.queue.filter((q) => q.id !== item.id);
          console.error(`Failed to sync item ${item.id} after ${this.maxRetries} retries`);
        }
      }
    }

    // Update queue with failed items that can be retried
    this.queue = [...this.queue.filter((q) => !itemsToSync.some((i) => i.id === q.id)), ...failedItems];
    this.saveQueue();

    if (this.queue.length === 0) {
      this.lastSyncTime = new Date();
      this.saveQueue();
    } else if (failedItems.length > 0) {
      this.hasError = true;
      this.errorMessage = `${failedItems.length} item(s) failed to sync`;
    }

    this.syncInProgress = false;
    this.notifyListeners();
  }

  private async syncItem(item: SyncItem): Promise<void> {
    // This is a placeholder - implement actual sync logic
    // For example: POST to your API endpoint
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
  }

  getStatus(): SyncStatus {
    return {
      pendingCount: this.queue.length,
      lastSyncTime: this.lastSyncTime,
      hasError: this.hasError,
      errorMessage: this.errorMessage,
    };
  }

  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
    this.notifyListeners();
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current status
    listener(this.getStatus());
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  destroy() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online', this.handleOnline);
    this.listeners.clear();
  }
}

// Export singleton instance
export const syncSchedulerService = new SyncSchedulerService();

