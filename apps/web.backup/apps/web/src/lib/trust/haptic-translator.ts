/**
 * HapticTrustTranslator
 * Task 14: Add HapticTrustTranslator (impact patterns)
 *
 * Translates trust states and changes into haptic feedback patterns
 * for mobile devices.
 */

export type HapticPattern =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'pulse'
  | 'heartbeat'
  | 'resonance'
  | 'anchor_drop'
  | 'trust_storm';

export interface HapticImpact {
  pattern: HapticPattern;
  intensity: number; // 0-1
  duration: number; // milliseconds
  delay?: number; // milliseconds before starting
  repetitions?: number; // number of times to repeat
  metadata?: Record<string, unknown>;
}

export interface TrustHapticMapping {
  trustScore: number; // 0-1
  trustChange: number; // -1 to 1, change in trust
  impact: HapticImpact;
}

export class HapticTrustTranslator {
  private patternMap: Map<HapticPattern, HapticImpact>;

  constructor() {
    this.patternMap = new Map([
      ['success', {
        pattern: 'success',
        intensity: 0.6,
        duration: 100,
        repetitions: 1,
      }],
      ['warning', {
        pattern: 'warning',
        intensity: 0.4,
        duration: 150,
        repetitions: 2,
      }],
      ['error', {
        pattern: 'error',
        intensity: 0.8,
        duration: 200,
        repetitions: 3,
      }],
      ['pulse', {
        pattern: 'pulse',
        intensity: 0.5,
        duration: 50,
        repetitions: 3,
      }],
      ['heartbeat', {
        pattern: 'heartbeat',
        intensity: 0.4,
        duration: 50,
        repetitions: 2,
      }],
      ['resonance', {
        pattern: 'resonance',
        intensity: 0.3,
        duration: 100,
        repetitions: 5,
      }],
      ['anchor_drop', {
        pattern: 'anchor_drop',
        intensity: 0.7,
        duration: 150,
        repetitions: 1,
      }],
      ['trust_storm', {
        pattern: 'trust_storm',
        intensity: 0.9,
        duration: 300,
        repetitions: 4,
      }],
    ]);
  }

  /**
   * Translate trust state to haptic impact
   */
  translateTrustToHaptic(
    trustScore: number,
    trustChange: number,
    context?: {
      credentialStatus?: 'verified' | 'pending' | 'expired';
      verificationResult?: 'pass' | 'fail';
      anchorStatus?: 'anchored' | 'pending' | 'failed';
    }
  ): HapticImpact {
    // Determine pattern based on trust change
    let pattern: HapticPattern;

    if (context?.anchorStatus === 'anchored') {
      pattern = 'anchor_drop';
    } else if (context?.verificationResult === 'pass') {
      pattern = 'success';
    } else if (trustChange > 0.2) {
      pattern = 'resonance';
    } else if (trustChange < -0.2) {
      pattern = trustScore < 0.3 ? 'trust_storm' : 'warning';
    } else if (trustScore > 0.8) {
      pattern = 'heartbeat';
    } else if (trustScore < 0.4) {
      pattern = 'error';
    } else {
      pattern = 'pulse';
    }

    // Get base impact
    const baseImpact = this.patternMap.get(pattern)!;

    // Adjust intensity based on trust score and change
    let intensity = baseImpact.intensity;
    if (Math.abs(trustChange) > 0.3) {
      intensity = Math.min(1, intensity + Math.abs(trustChange) * 0.3);
    }
    intensity = Math.max(0.2, Math.min(1, intensity));

    // Adjust duration based on context
    let duration = baseImpact.duration;
    if (context?.credentialStatus === 'expired') {
      duration *= 1.5; // Longer for critical states
    }

    return {
      ...baseImpact,
      intensity,
      duration,
      metadata: {
        trustScore,
        trustChange,
        context,
      },
    };
  }

  /**
   * Generate haptic sequence for trust transition
   */
  generateTrustTransitionSequence(
    fromTrust: number,
    toTrust: number,
    durationMs: number = 1000
  ): HapticImpact[] {
    const sequence: HapticImpact[] = [];
    const trustChange = toTrust - fromTrust;
    const steps = Math.max(2, Math.min(5, Math.ceil(Math.abs(trustChange) * 10)));

    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      const currentTrust = fromTrust + trustChange * progress;

      const impact = this.translateTrustToHaptic(currentTrust, trustChange / steps);
      impact.delay = (durationMs / steps) * i;

      sequence.push(impact);
    }

    return sequence;
  }

  /**
   * Translate specific trust events to haptics
   */
  translateEvent(
    eventType:
      | 'credential_verified'
      | 'credential_expired'
      | 'anchor_confirmed'
      | 'verification_failed'
      | 'trust_increased'
      | 'trust_decreased'
      | 'compliance_warning'
  ): HapticImpact {
    const mapping: Record<string, HapticImpact> = {
      credential_verified: {
        pattern: 'success',
        intensity: 0.6,
        duration: 100,
        repetitions: 1,
      },
      credential_expired: {
        pattern: 'error',
        intensity: 0.8,
        duration: 200,
        repetitions: 2,
      },
      anchor_confirmed: {
        pattern: 'anchor_drop',
        intensity: 0.7,
        duration: 150,
        repetitions: 1,
      },
      verification_failed: {
        pattern: 'error',
        intensity: 0.9,
        duration: 250,
        repetitions: 3,
      },
      trust_increased: {
        pattern: 'resonance',
        intensity: 0.5,
        duration: 100,
        repetitions: 3,
      },
      trust_decreased: {
        pattern: 'warning',
        intensity: 0.6,
        duration: 150,
        repetitions: 2,
      },
      compliance_warning: {
        pattern: 'warning',
        intensity: 0.5,
        duration: 120,
        repetitions: 2,
      },
    };

    return mapping[eventType] || this.patternMap.get('pulse')!;
  }

  /**
   * Get haptic pattern definition
   */
  getPattern(pattern: HapticPattern): HapticImpact {
    return this.patternMap.get(pattern)!;
  }

  /**
   * Register custom haptic pattern
   */
  registerPattern(pattern: HapticPattern, impact: HapticImpact): void {
    this.patternMap.set(pattern, impact);
  }
}

