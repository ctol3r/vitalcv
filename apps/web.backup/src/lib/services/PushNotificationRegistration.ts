/**
 * PushNotificationRegistration
 * Manages push notification registration and category preferences
 * Handles service worker registration and notification permissions
 */

export type NotificationCategory = 'reminders' | 'alerts' | 'announcements';

export interface NotificationPreferences {
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
}

class PushNotificationRegistration {
  private preferences: NotificationPreferences;
  private listeners: Set<(prefs: NotificationPreferences) => void> = new Set();
  private storageKey = 'vitalcv-push-preferences';

  constructor() {
    this.preferences = this.loadPreferences();
  }

  private loadPreferences(): NotificationPreferences {
    if (typeof window === 'undefined') {
      return {
        enabled: false,
        categories: {
          reminders: false,
          alerts: false,
          announcements: false,
        },
      };
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load push notification preferences:', error);
    }

    return {
      enabled: false,
      categories: {
        reminders: false,
        alerts: false,
        announcements: false,
      },
    };
  }

  private savePreferences(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.preferences));
    } catch (error) {
      console.warn('Failed to save push notification preferences:', error);
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  getPermission(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    return Notification.permission;
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      return registration;
    } catch (error) {
      console.error('Failed to register service worker:', error);
      return null;
    }
  }

  async subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
        ),
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  setEnabled(enabled: boolean): void {
    this.preferences.enabled = enabled;
    this.savePreferences();
    this.notifyListeners();
  }

  setCategoryEnabled(category: NotificationCategory, enabled: boolean): void {
    this.preferences.categories[category] = enabled;
    this.savePreferences();
    this.notifyListeners();
  }

  toggleCategory(category: NotificationCategory): void {
    this.setCategoryEnabled(category, !this.preferences.categories[category]);
  }

  subscribe(listener: (prefs: NotificationPreferences) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current preferences
    listener(this.getPreferences());
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const prefs = this.getPreferences();
    this.listeners.forEach((listener) => listener(prefs));
  }
}

// Export singleton instance
export const pushNotificationRegistration = new PushNotificationRegistration();

