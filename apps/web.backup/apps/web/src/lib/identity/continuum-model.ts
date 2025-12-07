/**
 * Identity Continuum Model
 * Task 1: Add Identity Continuum Model (static → dynamic → resonant)
 *
 * Represents identity evolution from static credentials to dynamic
 * professional identity to resonant multi-device coherence.
 */

export type IdentityPhase = 'static' | 'dynamic' | 'resonant';

export interface IdentityContinuumState {
  phase: IdentityPhase;
  coherenceScore: number; // 0-1
  lastSynchronized: Date;
  deviceCount: number;
  credentialDensity: number; // credentials per specialty
  resonanceFrequency: number; // sync events per hour
}

export interface StaticIdentity {
  credentials: string[];
  specialties: string[];
  certifications: string[];
  issuedAt: Date;
}

export interface DynamicIdentity {
  currentRoles: string[];
  activeProjects: string[];
  skillTrajectory: SkillTrajectory[];
  credentialVelocity: number; // new credentials per year
}

export interface ResonantIdentity {
  synchronizedDevices: string[];
  crossPlatformCoherence: number;
  trustWave: TrustWaveState;
  identityVibrations: IdentityVibration[];
}

export interface SkillTrajectory {
  skill: string;
  confidence: number;
  trend: 'rising' | 'stable' | 'declining';
  evidenceCount: number;
}

export interface TrustWaveState {
  amplitude: number; // 0-1
  frequency: number;
  phase: number;
  coherence: number;
}

export interface IdentityVibration {
  source: 'device' | 'credential' | 'verification' | 'update';
  intensity: number;
  timestamp: Date;
  affectedFields: string[];
}

export class IdentityContinuumModel {
  private state: IdentityContinuumState;

  constructor(initialState?: Partial<IdentityContinuumState>) {
    this.state = {
      phase: 'static',
      coherenceScore: 0.5,
      lastSynchronized: new Date(),
      deviceCount: 1,
      credentialDensity: 0,
      resonanceFrequency: 0,
      ...initialState,
    };
  }

  /**
   * Evaluate current phase based on state metrics
   */
  evaluatePhase(staticId: StaticIdentity, dynamicId?: DynamicIdentity, resonantId?: ResonantIdentity): IdentityPhase {
    const hasDynamic = dynamicId && dynamicId.currentRoles.length > 0;
    const hasResonant = resonantId && resonantId.synchronizedDevices.length > 1;

    if (hasResonant && resonantId!.crossPlatformCoherence > 0.8) {
      return 'resonant';
    }
    if (hasDynamic && dynamicId!.credentialVelocity > 0.5) {
      return 'dynamic';
    }
    return 'static';
  }

  /**
   * Calculate coherence score across all phases
   */
  calculateCoherence(
    staticId: StaticIdentity,
    dynamicId?: DynamicIdentity,
    resonantId?: ResonantIdentity
  ): number {
    let score = 0.3; // Base static score

    // Static coherence (30%)
    const credentialConsistency = staticId.credentials.length > 0 ? 0.3 : 0;
    score += credentialConsistency;

    // Dynamic coherence (40%)
    if (dynamicId) {
      const roleAlignment = dynamicId.currentRoles.length > 0 ? 0.2 : 0;
      const trajectoryStrength = dynamicId.skillTrajectory.reduce(
        (sum, t) => sum + t.confidence * (t.trend === 'rising' ? 1.2 : 1),
        0
      ) / Math.max(1, dynamicId.skillTrajectory.length) * 0.2;
      score += roleAlignment + trajectoryStrength;
    }

    // Resonant coherence (30%)
    if (resonantId) {
      score += resonantId.crossPlatformCoherence * 0.3;
      score += Math.min(0.15, resonantId.trustWave.coherence * 0.15);
    }

    return Math.min(1, score);
  }

  /**
   * Project phase transition likelihood
   */
  projectTransition(
    targetPhase: IdentityPhase,
    currentMetrics: IdentityContinuumState
  ): { probability: number; timeToTransition: number; blockers: string[] } {
    const blockers: string[] = [];
    let probability = 0.5;

    if (targetPhase === 'dynamic' && currentMetrics.phase === 'static') {
      if (currentMetrics.credentialDensity < 2) {
        blockers.push('Need more credentials per specialty');
        probability -= 0.3;
      }
    }

    if (targetPhase === 'resonant' && currentMetrics.phase !== 'resonant') {
      if (currentMetrics.deviceCount < 2) {
        blockers.push('Need multiple devices for resonance');
        probability -= 0.4;
      }
      if (currentMetrics.resonanceFrequency < 1) {
        blockers.push('Low synchronization frequency');
        probability -= 0.3;
      }
    }

    const timeToTransition = blockers.length > 0 ? 90 : 30; // days

    return {
      probability: Math.max(0, Math.min(1, probability)),
      timeToTransition,
      blockers,
    };
  }

  /**
   * Get current state
   */
  getState(): IdentityContinuumState {
    return { ...this.state };
  }

  /**
   * Update state
   */
  updateState(updates: Partial<IdentityContinuumState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Calculate resonance frequency from recent vibrations
   */
  calculateResonanceFrequency(vibrations: IdentityVibration[], hours: number = 24): number {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recent = vibrations.filter((v) => v.timestamp >= cutoff);
    return recent.length / hours;
  }
}

