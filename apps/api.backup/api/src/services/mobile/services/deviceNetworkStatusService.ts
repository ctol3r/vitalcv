export type NetworkStatus = 'online' | 'offline' | 'slow' | 'metered';

export interface NetworkStatusChangeEvent {
  status: NetworkStatus;
  previousStatus: NetworkStatus;
  timestamp: Date;
}

export type NetworkStatusCallback = (event: NetworkStatusChangeEvent) => void;

/**
 * DeviceNetworkStatusService monitors network connectivity
 * Supports offline detection, metered connections, and airplane mode
 */
export class DeviceNetworkStatusService {
  private currentStatus: NetworkStatus = 'online';
  private callbacks: Set<NetworkStatusCallback> = new Set();
  private onlineListener?: () => void;
  private offlineListener?: () => void;

  constructor() {
    if (typeof window !== 'undefined' && 'navigator' in window) {
      this.initializeBrowserListeners();
    } else {
      // Server-side: assume online
      this.currentStatus = 'online';
    }
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return this.currentStatus === 'online' || this.currentStatus === 'slow';
  }

  /**
   * Check if device is offline
   */
  isOffline(): boolean {
    return this.currentStatus === 'offline';
  }

  /**
   * Subscribe to network status changes
   */
  onStatusChange(callback: NetworkStatusCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Manually set network status (useful for testing or custom detection)
   */
  setStatus(status: NetworkStatus): void {
    const previousStatus = this.currentStatus;
    if (previousStatus === status) {
      return;
    }

    this.currentStatus = status;
    this.notifyCallbacks({
      status,
      previousStatus,
      timestamp: new Date(),
    });
  }

  /**
   * Simulate network status change (for testing)
   */
  simulateStatusChange(status: NetworkStatus): void {
    this.setStatus(status);
  }

  /**
   * Initialize browser event listeners
   */
  private initializeBrowserListeners(): void {
    if (typeof window === 'undefined' || !('navigator' in window)) {
      return;
    }

    // Check initial status
    this.currentStatus = navigator.onLine ? 'online' : 'offline';

    // Listen for online/offline events
    this.onlineListener = () => {
      this.setStatus('online');
    };

    this.offlineListener = () => {
      this.setStatus('offline');
    };

    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);

    // Check for connection API (if available)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        this.updateStatusFromConnection(connection);

        // Listen for connection changes
        connection.addEventListener('change', () => {
          this.updateStatusFromConnection(connection);
        });
      }
    }
  }

  /**
   * Update status based on Connection API
   */
  private updateStatusFromConnection(connection: any): void {
    if (!connection) {
      return;
    }

    // Check if connection is metered
    if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      this.setStatus('metered');
    } else if (connection.effectiveType === '3g') {
      this.setStatus('slow');
    } else if (navigator.onLine) {
      this.setStatus('online');
    } else {
      this.setStatus('offline');
    }
  }

  /**
   * Notify all callbacks of status change
   */
  private notifyCallbacks(event: NetworkStatusChangeEvent): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in network status callback:', error);
      }
    });
  }

  /**
   * Cleanup listeners
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onlineListener) {
        window.removeEventListener('online', this.onlineListener);
      }
      if (this.offlineListener) {
        window.removeEventListener('offline', this.offlineListener);
      }
    }
    this.callbacks.clear();
  }
}

