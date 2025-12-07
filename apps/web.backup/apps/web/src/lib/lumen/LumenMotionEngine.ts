/**
 * LumenMotionEngine
 * Motion grammar and animation curves for LUMEN system
 */

import type { LumenPhysicsConfig } from './types';

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface EaseCurve {
  type: 'easeIn' | 'easeOut' | 'easeInOut' | 'cubic' | 'linear';
  values?: number[]; // Custom cubic bezier values
}

export interface PulsePattern {
  type: 'heartbeat' | 'tension' | 'recovery' | 'breathing';
  duration: number; // milliseconds
  intensity: number; // 0.0 - 1.0
}

export class LumenMotionEngine {
  private physics: LumenPhysicsConfig;
  private reducedMotion: boolean;

  constructor(physics: LumenPhysicsConfig, reducedMotion: boolean = false) {
    this.physics = physics;
    this.reducedMotion = reducedMotion;
  }

  /**
   * Get spring preset configurations
   */
  getSpringPreset(type: 'soft' | 'firm' | 'critical'): SpringConfig {
    const presets: Record<string, SpringConfig> = {
      soft: {
        stiffness: 100,
        damping: 20,
        mass: 1,
      },
      firm: {
        stiffness: 300,
        damping: 30,
        mass: 1,
      },
      critical: {
        stiffness: 500,
        damping: 40,
        mass: 0.8,
      },
    };

    if (this.reducedMotion) {
      // Reduce motion intensity
      return {
        stiffness: presets[type].stiffness * 0.5,
        damping: presets[type].damping * 1.2,
        mass: presets[type].mass * 1.5,
      };
    }

    return presets[type];
  }

  /**
   * Get ease curve configuration
   */
  getEaseCurve(type: EaseCurve['type'], customValues?: number[]): string {
    if (this.reducedMotion) {
      return 'linear';
    }

    const curves: Record<string, string> = {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      cubic: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      linear: 'linear',
    };

    if (customValues && customValues.length === 4) {
      return `cubic-bezier(${customValues.join(', ')})`;
    }

    return curves[type] || curves.easeInOut;
  }

  /**
   * Calculate pulse pattern timing
   */
  getPulsePattern(type: PulsePattern['type'], intensity: number = 0.6): PulsePattern {
    const patterns: Record<string, PulsePattern> = {
      heartbeat: {
        type: 'heartbeat',
        duration: 800,
        intensity: intensity * 0.8,
      },
      tension: {
        type: 'tension',
        duration: 1200,
        intensity: intensity * 1.2,
      },
      recovery: {
        type: 'recovery',
        duration: 2000,
        intensity: intensity * 0.5,
      },
      breathing: {
        type: 'breathing',
        duration: 3000,
        intensity: intensity,
      },
    };

    if (this.reducedMotion) {
      return {
        ...patterns[type],
        duration: patterns[type].duration * 2,
        intensity: patterns[type].intensity * 0.3,
      };
    }

    return patterns[type];
  }

  /**
   * Calculate orbital drift deceleration
   */
  getDriftDeceleration(): number {
    // Based on physics friction and air resistance
    const decel = this.physics.friction + this.physics.airResistance;
    return Math.max(0.1, Math.min(0.95, decel));
  }

  /**
   * Calculate magnetic pull strength
   */
  getMagneticPullStrength(distance: number, matchScore: number): number {
    // Inverse square law with match score modifier
    const base = this.physics.gravity * matchScore;
    return base / (1 + distance * distance * 0.01);
  }

  /**
   * Calculate ripple convergence speed
   */
  getRippleConvergenceSpeed(rippleCount: number): number {
    // More ripples = slower convergence for clarity
    return Math.max(0.3, 1.0 - rippleCount * 0.1);
  }

  /**
   * Get animation duration based on battery mode
   */
  getAnimationDuration(baseDuration: number, batteryMode: 'normal' | 'efficient'): number {
    if (batteryMode === 'efficient') {
      return baseDuration * 0.7; // Faster animations = less CPU
    }
    return baseDuration;
  }

  /**
   * Calculate breathing animation rate
   */
  getBreathingRate(trustScore: number): number {
    // Higher trust = slower, calmer breathing
    // Base: 3 seconds per breath cycle
    const baseRate = 3000;
    const trustModifier = 1.0 - trustScore * 0.4; // 60% speed at max trust
    return baseRate * trustModifier;
  }

  /**
   * Calculate rotation velocity
   */
  getRotationVelocity(skillDepth: number): number {
    // Higher skill = faster rotation (up to a point)
    return Math.min(2.0, 0.5 + skillDepth * 1.5) * (this.reducedMotion ? 0.3 : 1.0);
  }

  /**
   * Calculate jitter amount
   */
  getJitterAmount(riskScore: number, staleAnchor: boolean): number {
    if (this.reducedMotion) return 0;

    const baseJitter = riskScore * 0.1;
    const staleBonus = staleAnchor ? 0.15 : 0;
    return Math.min(0.3, baseJitter + staleBonus);
  }
}

