/**
 * LumenEngine
 * Master orchestrator for the LUMEN visual identity system
 */

import type {
  LumenStateSnapshot,
  LumenPhysicsConfig,
  LumenEvent,
  LumenContextConfig,
} from './types';

export class LumenEngine {
  private snapshot: LumenStateSnapshot | null = null;
  private config: LumenContextConfig;
  private eventListeners: Map<string, Set<(event: LumenEvent) => void>> = new Map();

  constructor(config: Partial<LumenContextConfig> = {}) {
    this.config = {
      role: config.role ?? 'Clinician',
      physics: config.physics ?? {
        gravity: 0.5,
        elasticity: 0.7,
        pulseStrength: 0.6,
        friction: 0.3,
        airResistance: 0.2,
      },
      colorSpectrum: config.colorSpectrum ?? {
        emerald: '#10b981',
        anchorBlue: '#3b82f6',
        riskAmber: '#f59e0b',
        veilPurple: '#a78bfa',
        complianceGray: '#6b7280',
      },
      reducedMotion: config.reducedMotion ?? false,
      batteryMode: config.batteryMode ?? 'normal',
    };
  }

  /**
   * Update the current state snapshot
   */
  updateSnapshot(snapshot: LumenStateSnapshot): void {
    const previous = this.snapshot;
    this.snapshot = snapshot;

    // Emit events for significant changes
    if (previous) {
      if (Math.abs(previous.trust - snapshot.trust) > 0.05) {
        this.emit({
          type: 'TRUST_CHANGE',
          trustScore: snapshot.trust,
        });
      }

      if (Math.abs(previous.compliance - snapshot.compliance) > 0.1) {
        this.emit({
          type: 'COMPLIANCE_UPDATE',
          compliance: snapshot.compliance,
        });
      }

      if (
        Math.abs(previous.chain.chainHealth - snapshot.chain.chainHealth) > 0.1
      ) {
        this.emit({
          type: 'CHAIN_HEALTH_CHANGE',
          health: snapshot.chain.chainHealth,
        });
      }
    }
  }

  /**
   * Get current state snapshot
   */
  getSnapshot(): LumenStateSnapshot | null {
    return this.snapshot;
  }

  /**
   * Get current configuration
   */
  getConfig(): LumenContextConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<LumenContextConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Subscribe to LUMEN events
   */
  on(eventType: LumenEvent['type'], callback: (event: LumenEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: LumenEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`[LumenEngine] Error in event listener:`, error);
        }
      });
    }
  }

  /**
   * Trigger an external event
   */
  trigger(event: LumenEvent): void {
    this.emit(event);
  }

  /**
   * Calculate trust gradient color
   */
  getTrustGradient(trustScore: number): string {
    const { emerald, riskAmber, complianceGray } = this.config.colorSpectrum;
    if (trustScore >= 0.8) return emerald;
    if (trustScore >= 0.5) return this.interpolateColor(riskAmber, emerald, (trustScore - 0.5) / 0.3);
    return this.interpolateColor(complianceGray, riskAmber, trustScore / 0.5);
  }

  /**
   * Calculate opacity based on risk
   */
  getRiskOpacity(riskScore: number): number {
    // Higher risk = lower opacity (more transparent = more risky)
    return Math.max(0.3, 1.0 - riskScore);
  }

  /**
   * Interpolate between two hex colors
   */
  private interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    if (!c1 || !c2) return color1;

    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);

    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }
}

// Singleton instance
let globalEngine: LumenEngine | null = null;

export function getLumenEngine(config?: Partial<LumenContextConfig>): LumenEngine {
  if (!globalEngine) {
    globalEngine = new LumenEngine(config);
  }
  return globalEngine;
}

