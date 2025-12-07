/**
 * DeviceNetworkStatusService
 * Manages network status monitoring (online/offline/connecting)
 * Provides real-time network status updates
 */

export type NetworkStatus = 'online' | 'offline' | 'connecting';

class DeviceNetworkStatusService {
  private status: NetworkStatus = 'online';
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    // Initialize status
    this.status = navigator.onLine ? 'online' : 'offline';

    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Periodically check connection quality
    this.startConnectionCheck();
  }

  private handleOnline = () => {
    this.setStatus('online');
  };

  private handleOffline = () => {
    this.setStatus('offline');
  };

  private startConnectionCheck() {
    // Check connection every 5 seconds
    setInterval(() => {
      if (navigator.onLine) {
        // Test actual connectivity with a lightweight request
        this.testConnection();
      }
    }, 5000);
  }

  private async testConnection() {
    if (this.status === 'offline') {
      this.setStatus('connecting');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      await fetch('/api/healthz', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);
      this.setStatus('online');
    } catch (error) {
      // If we're online but can't reach server, still consider offline
      if (navigator.onLine) {
        this.setStatus('offline');
      }
    }
  }

  private setStatus(status: NetworkStatus) {
    if (this.status !== status) {
      this.status = status;
      this.notifyListeners();
    }
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  subscribe(listener: (status: NetworkStatus) => void): () => void {
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
    window.removeEventListener('offline', this.handleOffline);
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const deviceNetworkStatusService = new DeviceNetworkStatusService();

