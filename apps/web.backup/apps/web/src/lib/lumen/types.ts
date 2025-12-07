/**
 * LUMEN Core Types
 * Type definitions for the LUMEN visual identity system
 */

export type TrustScore = number; // 0.0 - 1.0
export type RiskScore = number; // 0.0 - 1.0
export type ComplianceScore = number; // 0.0 - 1.0
export type SkillDepth = number; // 0.0 - 1.0
export type PrivilegeLevel = number; // 0 - 10

export interface LumenStateSnapshot {
  trust: TrustScore;
  compliance: ComplianceScore;
  skill: SkillDepth;
  privilege: PrivilegeLevel;
  chain: {
    anchorConfidence: number;
    multiChainActive: boolean;
    chainHealth: number;
  };
  timestamp: number;
}

export interface LumenPhysicsConfig {
  gravity: number; // 0.0 - 1.0
  elasticity: number; // 0.0 - 1.0
  pulseStrength: number; // 0.0 - 1.0
  friction: number; // 0.0 - 1.0
  airResistance: number; // 0.0 - 1.0
}

export interface LumenColorSpectrum {
  emerald: string; // Primary trust color
  anchorBlue: string; // Chain anchor color
  riskAmber: string; // Risk warning color
  veilPurple: string; // ZK proof color
  complianceGray: string; // Compliance neutral
}

export interface OrbState {
  luminance: number; // 0.0 - 1.0, driven by trustScore
  breathingRate: number; // breaths per second, driven by trustScore
  elasticity: number; // 0.0 - 1.0, driven by compliance
  surfaceTension: number; // 0.0 - 1.0, driven by riskScore
  rotation: number; // radians, driven by skill
  pulseIntensity: number; // 0.0 - 1.0
  jitterAmount: number; // 0.0 - 1.0, driven by stale anchor
}

export interface OrbitalPosition {
  radius: number; // Distance from center, driven by expiration proximity
  angle: number; // Position in orbit
  velocity: number; // Orbital velocity, driven by skill depth
  glowIntensity: number; // 0.0 - 1.0, driven by anchor confidence
  jitter: number; // 0.0 - 1.0, driven by riskScore
}

export interface ClimateState {
  type: 'clear' | 'cloud' | 'storm' | 'lightning';
  intensity: number; // 0.0 - 1.0
  nextTransition: number; // milliseconds until next state change
  forecast: {
    next90Days: ComplianceScore[];
  };
}

export interface ConstellationNode {
  id: string;
  skill: string;
  brightness: number; // 0.0 - 1.0, driven by verification depth
  twinkle: number; // 0.0 - 1.0, driven by recency
  position: { x: number; y: number; z: number };
  competency: 'Observer' | 'Practitioner' | 'Expert';
  attestations: string[]; // IDs of linked skills
}

export interface ZKPetalState {
  state: 'closed' | 'half-open' | 'open';
  bloomProgress: number; // 0.0 - 1.0
  attributeHash: string;
  revealed: boolean;
}

export interface ChainRipple {
  id: string;
  anchorId: string;
  origin: { x: number; y: number };
  radius: number;
  intensity: number;
  timestamp: number;
  converging: boolean; // true if multiple chains converging
}

export type LumenEvent =
  | { type: 'TRUST_CHANGE'; trustScore: TrustScore }
  | { type: 'ANCHOR_CONFIRMED'; anchorId: string }
  | { type: 'COMPLIANCE_UPDATE'; compliance: ComplianceScore }
  | { type: 'SKILL_VERIFIED'; skillId: string; depth: SkillDepth }
  | { type: 'ZK_REVEAL'; attributeHash: string }
  | { type: 'RISK_DETECTED'; riskScore: RiskScore }
  | { type: 'CHAIN_HEALTH_CHANGE'; health: number };

export type RoleType = 'Nurse' | 'Clinician' | 'Recruiter' | 'Facility' | 'Admin';

export interface LumenContextConfig {
  role: RoleType;
  physics: LumenPhysicsConfig;
  colorSpectrum: LumenColorSpectrum;
  reducedMotion: boolean;
  batteryMode: 'normal' | 'efficient';
}

