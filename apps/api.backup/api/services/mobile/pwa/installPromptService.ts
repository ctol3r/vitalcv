/**
 * PWAInstallPromptService
 *
 * Handles browser events to prompt users to install the PWA:
 * - Logs user responses
 * - Exposes methods to trigger and hide prompt
 * - Ensures prompt appears only when appropriate
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

export interface InstallPromptResult {
  outcome: 'accepted' | 'dismissed' | 'not_available';
  platform?: string;
}

/**
 * PWA install prompt service
 * Handles PWA installation prompts and user responses
 */
export class PWAInstallPromptService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installListeners: Array<(result: InstallPromptResult) => void> = [];
  private isInstalled: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
      this.checkIfInstalled();
    }
  }

  /**
   * Setup event listeners for install prompt
   */
  private setupEventListeners(): void {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.notifyPromptAvailable();
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.notifyInstalled();
    });
  }

  /**
   * Check if PWA is already installed
   */
  private checkIfInstalled(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // Check if running in standalone mode (installed)
    if (
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    ) {
      this.isInstalled = true;
    }
  }

  /**
   * Check if install prompt is available
   */
  isPromptAvailable(): boolean {
    return this.deferredPrompt !== null && !this.isInstalled;
  }

  /**
   * Check if PWA is already installed
   */
  isAppInstalled(): boolean {
    return this.isInstalled;
  }

  /**
   * Trigger the install prompt
   */
  async showInstallPrompt(): Promise<InstallPromptResult> {
    if (this.isInstalled) {
      return {
        outcome: 'not_available',
      };
    }

    if (!this.deferredPrompt) {
      return {
        outcome: 'not_available',
      };
    }

    try {
      // Show the install prompt
      await this.deferredPrompt.prompt();

      // Wait for user response
      const choiceResult = await this.deferredPrompt.userChoice;

      const result: InstallPromptResult = {
        outcome: choiceResult.outcome,
        platform: choiceResult.platform,
      };

      // Log user response
      this.logInstallResponse(result);

      // Clear the deferred prompt
      this.deferredPrompt = null;

      // Notify listeners
      this.notifyListeners(result);

      return result;
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return {
        outcome: 'not_available',
      };
    }
  }

  /**
   * Hide/dismiss the install prompt
   */
  hideInstallPrompt(): void {
    // The prompt can't be programmatically dismissed,
    // but we can clear our reference to it
    this.deferredPrompt = null;
  }

  /**
   * Add listener for install events
   */
  onInstall(callback: (result: InstallPromptResult) => void): () => void {
    this.installListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.installListeners.indexOf(callback);
      if (index > -1) {
        this.installListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify listeners that prompt is available
   */
  private notifyPromptAvailable(): void {
    // Notify listeners that prompt is ready
    this.installListeners.forEach((listener) => {
      listener({
        outcome: 'not_available', // Special case: prompt available but not shown yet
      });
    });
  }

  /**
   * Notify listeners that app was installed
   */
  private notifyInstalled(): void {
    this.notifyListeners({
      outcome: 'accepted',
    });
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(result: InstallPromptResult): void {
    this.installListeners.forEach((listener) => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in install listener:', error);
      }
    });
  }

  /**
   * Log install response for analytics
   */
  private logInstallResponse(result: InstallPromptResult): void {
    // In production, send to analytics service
    console.log('[PWA Install] User response:', result);

    // Example analytics call:
    // analytics.track('pwa_install_prompt', {
    //   outcome: result.outcome,
    //   platform: result.platform,
    //   timestamp: new Date().toISOString(),
    // });
  }

  /**
   * Get install prompt status
   */
  getStatus(): {
    isInstalled: boolean;
    promptAvailable: boolean;
    canInstall: boolean;
  } {
    return {
      isInstalled: this.isInstalled,
      promptAvailable: this.isPromptAvailable(),
      canInstall: this.isPromptAvailable() && !this.isInstalled,
    };
  }

  /**
   * Check if platform supports PWA installation
   */
  static isPlatformSupported(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    // Check for beforeinstallprompt support
    // This is available in Chrome, Edge, Samsung Internet, etc.
    // Not available in Safari (iOS uses different mechanism)

    // Check if we're on iOS (different install flow)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      // iOS supports PWA installation but uses different mechanism
      return true;
    }

    // Check for beforeinstallprompt support
    return 'onbeforeinstallprompt' in window;
  }

  /**
   * Get platform-specific install instructions
   */
  static getInstallInstructions(): string {
    if (typeof navigator === 'undefined') {
      return 'Install instructions not available';
    }

    const userAgent = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(userAgent)) {
      return 'Tap the Share button, then tap "Add to Home Screen"';
    } else if (/android/.test(userAgent)) {
      return 'Tap the menu (three dots) and select "Add to Home Screen" or "Install App"';
    } else if (/chrome|edge/.test(userAgent)) {
      return 'Click the install icon in the address bar or use the browser menu';
    } else {
      return 'Use your browser\'s menu to install this app';
    }
  }
}

// Create singleton instance
export const pwaInstallPromptService = typeof window !== 'undefined'
  ? new PWAInstallPromptService()
  : ({} as PWAInstallPromptService);

