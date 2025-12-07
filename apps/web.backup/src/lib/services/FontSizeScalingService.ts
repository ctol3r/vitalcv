/**
 * FontSizeScalingService
 * Manages font size scaling for accessibility
 * Persists scale factor to localStorage
 */

const STORAGE_KEY = 'vitalcv-font-size-scale';
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.875; // 87.5% (14px base)
const MAX_SCALE = 2; // 200% (32px base)
const SCALE_STEP = 0.125; // 12.5% increments

class FontSizeScalingService {
  private scale: number;
  private listeners: Set<(scale: number) => void> = new Set();

  constructor() {
    this.scale = this.loadScale();
    this.applyScale();
  }

  private loadScale(): number {
    if (typeof window === 'undefined') {
      return DEFAULT_SCALE;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load font size scale:', error);
    }

    return DEFAULT_SCALE;
  }

  private saveScale(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, this.scale.toString());
    } catch (error) {
      console.warn('Failed to save font size scale:', error);
    }
  }

  private applyScale(): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    root.style.fontSize = `${this.scale * 100}%`;
  }

  getScale(): number {
    return this.scale;
  }

  setScale(scale: number): void {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    this.scale = Math.round(clamped / SCALE_STEP) * SCALE_STEP; // Round to nearest step
    this.saveScale();
    this.applyScale();
    this.notifyListeners();
  }

  increase(): void {
    this.setScale(this.scale + SCALE_STEP);
  }

  decrease(): void {
    this.setScale(this.scale - SCALE_STEP);
  }

  reset(): void {
    this.setScale(DEFAULT_SCALE);
  }

  getMinScale(): number {
    return MIN_SCALE;
  }

  getMaxScale(): number {
    return MAX_SCALE;
  }

  getScaleStep(): number {
    return SCALE_STEP;
  }

  subscribe(listener: (scale: number) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current scale
    listener(this.getScale());
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.scale));
  }
}

// Export singleton instance
export const fontSizeScalingService = new FontSizeScalingService();

