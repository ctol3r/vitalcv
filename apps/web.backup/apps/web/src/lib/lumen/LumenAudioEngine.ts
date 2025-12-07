/**
 * LumenAudioEngine
 * Sound cues and audio feedback for LUMEN system
 */

export type SoundCue = 'trust-tone' | 'anchor-bell' | 'skill-chime' | 'risk-warning' | 'zk-reveal';

export interface AudioConfig {
  enabled: boolean;
  volume: number; // 0.0 - 1.0
  silentMode: boolean;
}

export class LumenAudioEngine {
  private config: AudioConfig;
  private audioContext: AudioContext | null = null;
  private audioCache: Map<SoundCue, AudioBuffer> = new Map();

  constructor(config: Partial<AudioConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      volume: config.volume ?? 0.5,
      silentMode: config.silentMode ?? false,
    };

    if (typeof window !== 'undefined') {
      this.initAudioContext();
    }
  }

  /**
   * Initialize Web Audio API context
   */
  private initAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('[LumenAudioEngine] Web Audio API not available:', error);
    }
  }

  /**
   * Play a sound cue
   */
  play(cue: SoundCue, options: { volume?: number; layer?: number } = {}): void {
    if (!this.config.enabled || this.config.silentMode || !this.audioContext) {
      return;
    }

    const volume = options.volume ?? this.config.volume;

    // Generate sound based on cue type
    this.generateSound(cue, volume, options.layer ?? 0);
  }

  /**
   * Generate synthetic sound for a cue
   */
  private generateSound(cue: SoundCue, volume: number, layer: number): void {
    if (!this.audioContext) return;

    try {
      let frequency: number;
      let duration: number;
      let type: OscillatorType = 'sine';

      switch (cue) {
        case 'trust-tone':
          frequency = 440 + layer * 110; // A4 and harmonics
          duration = 200;
          type = 'sine';
          break;
        case 'anchor-bell':
          frequency = 523.25; // C5
          duration = 500;
          type = 'sine';
          break;
        case 'skill-chime':
          frequency = 659.25; // E5
          duration = 150;
          type = 'triangle';
          break;
        case 'risk-warning':
          frequency = 220; // A3
          duration = 300;
          type = 'sawtooth';
          break;
        case 'zk-reveal':
          frequency = 880; // A5
          duration = 250;
          type = 'sine';
          break;
        default:
          frequency = 440;
          duration = 200;
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

      // Envelope
      const now = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + duration / 1000);
    } catch (error) {
      console.warn(`[LumenAudioEngine] Error playing sound ${cue}:`, error);
    }
  }

  /**
   * Play layered sounds (multiple cues at once)
   */
  playLayered(cues: Array<{ cue: SoundCue; delay?: number; volume?: number }>): void {
    cues.forEach(({ cue, delay = 0, volume }) => {
      setTimeout(() => {
        this.play(cue, { volume, layer: cues.indexOf({ cue, delay, volume }) });
      }, delay);
    });
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioConfig {
    return this.config;
  }

  /**
   * Check if audio is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && !this.config.silentMode;
  }

  /**
   * Enable/disable audio
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Set volume
   */
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
  }
}

