/**
 * LumenHapticsEngine
 * Haptic feedback signatures for LUMEN system
 */

export type HapticSignature =
  | 'anchorConfirm'
  | 'riskWarning'
  | 'trustBoost'
  | 'skillVerify'
  | 'complianceUpdate'
  | 'zkReveal'
  | 'chainPulse';

export interface HapticConfig {
  enabled: boolean;
  intensity: number; // 0.0 - 1.0
}

export interface HapticPattern {
  type: 'impact' | 'notification' | 'success' | 'warning';
  duration: number;
  intensity: number;
  intervals?: number[]; // For multi-pulse patterns
}

export class LumenHapticsEngine {
  private config: HapticConfig;
  private navigator: Navigator | null = null;

  constructor(config: Partial<HapticConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      intensity: config.intensity ?? 0.7,
    };

    if (typeof window !== 'undefined') {
      this.navigator = window.navigator;
    }
  }

  /**
   * Check if haptics are available
   */
  isAvailable(): boolean {
    if (!this.navigator) return false;

    // Check for Vibration API
    if ('vibrate' in this.navigator) return true;

    // Check for Haptic Feedback API (Progressive Web Apps)
    if ('vibrate' in this.navigator) return true;

    return false;
  }

  /**
   * Trigger a haptic signature
   */
  trigger(signature: HapticSignature, customIntensity?: number): void {
    if (!this.config.enabled || !this.isAvailable()) return;

    const intensity = customIntensity ?? this.config.intensity;
    const pattern = this.getHapticPattern(signature, intensity);

    this.execute(pattern);
  }

  /**
   * Get haptic pattern for a signature
   */
  private getHapticPattern(signature: HapticSignature, intensity: number): HapticPattern {
    const baseIntensity = Math.floor(intensity * 100);

    switch (signature) {
      case 'anchorConfirm':
        return {
          type: 'success',
          duration: 50,
          intensity: baseIntensity,
          intervals: [0, 30, 60], // Triple pulse
        };
      case 'riskWarning':
        return {
          type: 'warning',
          duration: 200,
          intensity: baseIntensity,
          intervals: [0, 50, 100, 150], // Alert pattern
        };
      case 'trustBoost':
        return {
          type: 'success',
          duration: 100,
          intensity: baseIntensity * 0.8,
          intervals: [0, 40], // Double pulse
        };
      case 'skillVerify':
        return {
          type: 'impact',
          duration: 30,
          intensity: baseIntensity * 0.6,
        };
      case 'complianceUpdate':
        return {
          type: 'notification',
          duration: 40,
          intensity: baseIntensity * 0.7,
        };
      case 'zkReveal':
        return {
          type: 'impact',
          duration: 60,
          intensity: baseIntensity * 0.9,
          intervals: [0, 25, 50], // Triple impact
        };
      case 'chainPulse':
        return {
          type: 'notification',
          duration: 25,
          intensity: baseIntensity * 0.5,
        };
      default:
        return {
          type: 'impact',
          duration: 50,
          intensity: baseIntensity,
        };
    }
  }

  /**
   * Execute haptic pattern
   */
  private execute(pattern: HapticPattern): void {
    if (!this.navigator || !('vibrate' in this.navigator)) return;

    try {
      if (pattern.intervals && pattern.intervals.length > 1) {
        // Multi-pulse pattern
        const vibrationPattern = pattern.intervals.map((interval, index) => {
          if (index === 0) return 0;
          return interval - pattern.intervals![index - 1];
        });
        vibrationPattern.push(pattern.duration);

        // Adjust intensity by duration
        const scaledPattern = vibrationPattern.map((v) => Math.floor(v * (pattern.intensity / 100)));
        this.navigator.vibrate(scaledPattern);
      } else {
        // Single pulse
        const duration = Math.floor(pattern.duration * (pattern.intensity / 100));
        this.navigator.vibrate(duration);
      }
    } catch (error) {
      console.warn('[LumenHapticsEngine] Error executing haptic:', error);
    }
  }

  /**
   * Trigger 3D spatial haptics (multiple feedback layers)
   */
  triggerSpatial(patterns: Array<{ signature: HapticSignature; delay?: number }>): void {
    patterns.forEach(({ signature, delay = 0 }) => {
      setTimeout(() => {
        this.trigger(signature);
      }, delay);
    });
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<HapticConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): HapticConfig {
    return this.config;
  }

  /**
   * Check if haptics are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.isAvailable();
  }

  /**
   * Enable/disable haptics
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Set intensity
   */
  setIntensity(intensity: number): void {
    this.config.intensity = Math.max(0, Math.min(1, intensity));
  }
}

