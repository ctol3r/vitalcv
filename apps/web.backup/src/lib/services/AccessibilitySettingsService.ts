/**
 * AccessibilitySettingsService
 * Manages accessibility settings including high contrast mode
 * Persists settings to localStorage
 */

const STORAGE_KEY = 'vitalcv-accessibility-settings';

export interface AccessibilitySettings {
  highContrast: boolean;
}

class AccessibilitySettingsService {
  private settings: AccessibilitySettings;
  private listeners: Set<(settings: AccessibilitySettings) => void> = new Set();

  constructor() {
    // Initialize from localStorage or defaults
    this.settings = this.loadSettings();
    this.applySettings();
  }

  private loadSettings(): AccessibilitySettings {
    if (typeof window === 'undefined') {
      return { highContrast: false };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load accessibility settings:', error);
    }

    return { highContrast: false };
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save accessibility settings:', error);
    }
  }

  private applySettings(): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    if (this.settings.highContrast) {
      root.classList.add('high-contrast');
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.classList.remove('high-contrast');
      root.removeAttribute('data-high-contrast');
    }
  }

  getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  setHighContrast(enabled: boolean): void {
    this.settings.highContrast = enabled;
    this.saveSettings();
    this.applySettings();
    this.notifyListeners();
  }

  toggleHighContrast(): void {
    this.setHighContrast(!this.settings.highContrast);
  }

  subscribe(listener: (settings: AccessibilitySettings) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current settings
    listener(this.getSettings());
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const settings = this.getSettings();
    this.listeners.forEach((listener) => listener(settings));
  }
}

// Export singleton instance
export const accessibilitySettingsService = new AccessibilitySettingsService();

