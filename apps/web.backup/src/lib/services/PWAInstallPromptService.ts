/**
 * PWAInstallPromptService
 * Manages PWA installation prompts and banner display logic
 * Handles beforeinstallprompt event and user preferences
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PWAInstallPromptService {
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private listeners: Set<(available: boolean) => void> = new Set();
  private dismissedKey = 'vitalcv-pwa-banner-dismissed';
  private dismissedDays = 7; // Show again after 7 days

  constructor() {
    if (typeof window === 'undefined') return;

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
  }

  private handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    this.installPrompt = e as BeforeInstallPromptEvent;
    this.notifyListeners(true);
  };

  getInstallPrompt(): BeforeInstallPromptEvent | null {
    return this.installPrompt;
  }

  async promptInstall(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const choice = await this.installPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        this.installPrompt = null;
        this.notifyListeners(false);
        return true;
      }
    } catch (error) {
      console.error('Failed to show install prompt:', error);
    }

    return false;
  }

  isInstalled(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  isDismissed(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const dismissed = localStorage.getItem(this.dismissedKey);
      if (!dismissed) return false;

      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      return daysSinceDismissed < this.dismissedDays;
    } catch (error) {
      return false;
    }
  }

  dismiss(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.dismissedKey, Date.now().toString());
    } catch (error) {
      console.error('Failed to save dismissal:', error);
    }
  }

  shouldShowBanner(): boolean {
    return !this.isInstalled() && !this.isDismissed() && this.installPrompt !== null;
  }

  subscribe(listener: (available: boolean) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.installPrompt !== null);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(available: boolean): void {
    this.listeners.forEach((listener) => listener(available));
  }

  destroy() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
    this.listeners.clear();
  }
}

// Export singleton instance
export const pwaInstallPromptService = new PWAInstallPromptService();

