/**
 * Multi-Role Identity Engine
 * Phase 1: Role Architecture & Identity Switching
 *
 * Defines roles, integrates trust profiles, and builds the switching system.
 */

import type { TrustScore } from '@/lib/services/trust-service';

/**
 * RoleType Enum
 * Defines all professional roles in the VitalCV ecosystem
 */
export enum RoleType {
  CLINICIAN = 'clinician',
  NURSE = 'nurse',
  FACULTY = 'faculty',
  RESEARCHER = 'researcher',
  ADMINISTRATOR = 'administrator',
  PRECEPTOR = 'preceptor',
  TELEMEDICINE = 'telemedicine',
  MULTI_FACILITY = 'multi_facility',
}

/**
 * RoleProfile Model
 * Contains trust score, privileges, compliance, and skills for each role
 */
export interface RoleProfile {
  roleType: RoleType;
  did: string; // DID this role profile is bound to
  trustScore: number; // 0-1, role-specific trust score
  privileges: RolePrivileges;
  compliance: RoleCompliance;
  skills: RoleSkills;
  activatedAt: Date;
  lastUpdated: Date;
  isActive: boolean;
}

/**
 * Role Privileges
 * Defines what actions are allowed for this role
 */
export interface RolePrivileges {
  allowedActions: string[];
  restrictedTasks: string[];
  visibilityPermissions: {
    canViewCredentials: boolean;
    canViewChain: boolean;
    canViewCompliance: boolean;
    canViewSkills: boolean;
  };
  scopeOfPractice: {
    allowedProcedures: string[];
    allowedEducationalTasks: string[];
    allowedSupervisionTasks: string[];
  };
}

/**
 * Role Compliance
 * Tracks compliance requirements and status for the role
 */
export interface RoleCompliance {
  complianceScore: number; // 0-1
  requirements: ComplianceRequirement[];
  alerts: ComplianceAlert[];
  gaps: string[];
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  category: 'license' | 'certification' | 'training' | 'credentialing';
  status: 'met' | 'pending' | 'expired' | 'missing';
  dueDate?: Date;
  evidence?: string[];
}

export interface ComplianceAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  roleSpecific: boolean;
  actionRequired: boolean;
}

/**
 * Role Skills
 * Maps competencies and skills relevant to this role
 */
export interface RoleSkills {
  competencies: SkillCompetency[];
  competencyMap: Record<string, number>; // skill -> confidence (0-1)
}

export interface SkillCompetency {
  skill: string;
  confidence: number; // 0-1
  evidenceCount: number;
  lastVerified?: Date;
}

/**
 * Role Metadata
 * UI and display information for each role
 */
export interface RoleMetadata {
  roleType: RoleType;
  displayName: string;
  description: string;
  icon: string; // Icon identifier for UI
  color: {
    primary: string;
    accent: string;
    trust: string;
  };
  navigation: {
    primaryRoutes: string[];
    floatingActions: string[];
  };
}

/**
 * RoleEngine
 * Core engine for managing multi-role identity
 */
export class RoleEngine {
  private roleProfiles: Map<string, RoleProfile[]> = new Map(); // DID -> RoleProfile[]
  private currentRole: Map<string, RoleType> = new Map(); // DID -> current active role

  /**
   * Bind a role profile to a DID
   * One DID can have many role containers
   */
  bindRoleProfile(did: string, profile: RoleProfile): void {
    const existing = this.roleProfiles.get(did) || [];

    // Check if role already exists for this DID
    const existingIndex = existing.findIndex(
      (p) => p.roleType === profile.roleType
    );

    if (existingIndex >= 0) {
      // Update existing profile
      existing[existingIndex] = {
        ...profile,
        lastUpdated: new Date(),
      };
    } else {
      // Add new profile
      existing.push({
        ...profile,
        activatedAt: new Date(),
        lastUpdated: new Date(),
      });
    }

    this.roleProfiles.set(did, existing);
  }

  /**
   * Get all role profiles for a DID
   */
  getRoleProfiles(did: string): RoleProfile[] {
    return this.roleProfiles.get(did) || [];
  }

  /**
   * Get a specific role profile for a DID
   */
  getRoleProfile(did: string, roleType: RoleType): RoleProfile | null {
    const profiles = this.getRoleProfiles(did);
    return profiles.find((p) => p.roleType === roleType) || null;
  }

  /**
   * Switch active role for a DID
   */
  switchRole(did: string, roleType: RoleType): boolean {
    const profile = this.getRoleProfile(did, roleType);
    if (!profile) {
      return false;
    }

    if (!profile.isActive) {
      return false;
    }

    this.currentRole.set(did, roleType);
    return true;
  }

  /**
   * Get current active role for a DID
   */
  getCurrentRole(did: string): RoleType | null {
    return this.currentRole.get(did) || null;
  }

  /**
   * Calculate role-specific trust score
   * Different roles weight trust factors differently
   */
  calculateRoleTrustScore(
    roleType: RoleType,
    baseTrustScore: TrustScore,
    credentials: any[]
  ): number {
    // Base weights vary by role
    const roleWeights: Record<RoleType, { issuer: number; evidence: number; anchor: number; temporal: number }> = {
      [RoleType.CLINICIAN]: { issuer: 0.4, evidence: 0.3, anchor: 0.2, temporal: 0.1 },
      [RoleType.NURSE]: { issuer: 0.35, evidence: 0.35, anchor: 0.2, temporal: 0.1 },
      [RoleType.FACULTY]: { issuer: 0.3, evidence: 0.4, anchor: 0.15, temporal: 0.15 },
      [RoleType.RESEARCHER]: { issuer: 0.25, evidence: 0.45, anchor: 0.2, temporal: 0.1 },
      [RoleType.ADMINISTRATOR]: { issuer: 0.4, evidence: 0.25, anchor: 0.2, temporal: 0.15 },
      [RoleType.PRECEPTOR]: { issuer: 0.35, evidence: 0.35, anchor: 0.2, temporal: 0.1 },
      [RoleType.TELEMEDICINE]: { issuer: 0.3, evidence: 0.3, anchor: 0.3, temporal: 0.1 },
      [RoleType.MULTI_FACILITY]: { issuer: 0.35, evidence: 0.3, anchor: 0.25, temporal: 0.1 },
    };

    const weights = roleWeights[roleType];
    const breakdown = baseTrustScore.breakdown;

    return (
      breakdown.issuer * weights.issuer +
      breakdown.evidence * weights.evidence +
      breakdown.anchor * weights.anchor +
      breakdown.temporal * weights.temporal
    );
  }

  /**
   * Recalculate compliance score for a role
   */
  recalculateComplianceScore(profile: RoleProfile): number {
    const { requirements } = profile.compliance;
    if (requirements.length === 0) {
      return 1.0; // No requirements = fully compliant
    }

    const metCount = requirements.filter((r) => r.status === 'met').length;
    const expiredCount = requirements.filter((r) => r.status === 'expired').length;
    const missingCount = requirements.filter((r) => r.status === 'missing').length;

    // Weight: met = 1.0, pending = 0.5, expired = 0.0, missing = -0.2
    const score =
      (metCount * 1.0 +
        (requirements.length - metCount - expiredCount - missingCount) * 0.5 -
        expiredCount * 0.0 -
        missingCount * 0.2) /
      requirements.length;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get role metadata for UI
   */
  getRoleMetadata(roleType: RoleType): RoleMetadata {
    const metadataMap: Record<RoleType, RoleMetadata> = {
      [RoleType.CLINICIAN]: {
        roleType: RoleType.CLINICIAN,
        displayName: 'Clinician',
        description: 'Direct patient care provider',
        icon: 'stethoscope',
        color: {
          primary: '#2563eb', // blue
          accent: '#3b82f6',
          trust: '#1e40af',
        },
        navigation: {
          primaryRoutes: ['/wallet', '/verify', '/jobs', '/profile'],
          floatingActions: ['verify-credential', 'share-profile'],
        },
      },
      [RoleType.NURSE]: {
        roleType: RoleType.NURSE,
        displayName: 'Nurse',
        description: 'Registered nurse or advanced practice nurse',
        icon: 'heart-pulse',
        color: {
          primary: '#dc2626', // red
          accent: '#ef4444',
          trust: '#991b1b',
        },
        navigation: {
          primaryRoutes: ['/wallet', '/ceu', '/shifts', '/profile'],
          floatingActions: ['track-ceu', 'view-shifts'],
        },
      },
      [RoleType.FACULTY]: {
        roleType: RoleType.FACULTY,
        displayName: 'Faculty',
        description: 'Medical education and training',
        icon: 'graduation-cap',
        color: {
          primary: '#7c3aed', // purple
          accent: '#8b5cf6',
          trust: '#5b21b6',
        },
        navigation: {
          primaryRoutes: ['/portfolio', '/evaluate', '/publications', '/profile'],
          floatingActions: ['evaluate-resident', 'add-publication'],
        },
      },
      [RoleType.RESEARCHER]: {
        roleType: RoleType.RESEARCHER,
        displayName: 'Researcher',
        description: 'Clinical or academic research',
        icon: 'flask',
        color: {
          primary: '#059669', // green
          accent: '#10b981',
          trust: '#047857',
        },
        navigation: {
          primaryRoutes: ['/grants', '/irb', '/cv', '/publications'],
          floatingActions: ['submit-grant', 'track-irb'],
        },
      },
      [RoleType.ADMINISTRATOR]: {
        roleType: RoleType.ADMINISTRATOR,
        displayName: 'Administrator',
        description: 'Healthcare administration and leadership',
        icon: 'briefcase',
        color: {
          primary: '#ea580c', // orange
          accent: '#f97316',
          trust: '#c2410c',
        },
        navigation: {
          primaryRoutes: ['/dashboard', '/compliance', '/leadership', '/profile'],
          floatingActions: ['view-compliance', 'manage-team'],
        },
      },
      [RoleType.PRECEPTOR]: {
        roleType: RoleType.PRECEPTOR,
        displayName: 'Preceptor',
        description: 'Clinical supervision and mentoring',
        icon: 'users',
        color: {
          primary: '#0891b2', // cyan
          accent: '#06b6d4',
          trust: '#0e7490',
        },
        navigation: {
          primaryRoutes: ['/supervision', '/evaluate', '/mentees', '/profile'],
          floatingActions: ['evaluate-mentee', 'schedule-session'],
        },
      },
      [RoleType.TELEMEDICINE]: {
        roleType: RoleType.TELEMEDICINE,
        displayName: 'Telemedicine Provider',
        description: 'Remote healthcare delivery',
        icon: 'video',
        color: {
          primary: '#be185d', // pink
          accent: '#ec4899',
          trust: '#9f1239',
        },
        navigation: {
          primaryRoutes: ['/telemedicine', '/licenses', '/regions', '/profile'],
          floatingActions: ['check-eligibility', 'view-regions'],
        },
      },
      [RoleType.MULTI_FACILITY]: {
        roleType: RoleType.MULTI_FACILITY,
        displayName: 'Multi-Facility Provider',
        description: 'Provider across multiple facilities',
        icon: 'building-2',
        color: {
          primary: '#6366f1', // indigo
          accent: '#818cf8',
          trust: '#4f46e5',
        },
        navigation: {
          primaryRoutes: ['/facilities', '/privileges', '/scheduling', '/profile'],
          floatingActions: ['manage-privileges', 'view-schedule'],
        },
      },
    };

    return metadataMap[roleType];
  }

  /**
   * Check if role can be activated (requirements met)
   */
  canActivateRole(did: string, roleType: RoleType): {
    canActivate: boolean;
    blockers: string[];
    nextSteps: string[];
  } {
    const profile = this.getRoleProfile(did, roleType);
    if (!profile) {
      return {
        canActivate: false,
        blockers: ['Role profile not found'],
        nextSteps: ['Create role profile first'],
      };
    }

    const blockers: string[] = [];
    const nextSteps: string[] = [];

    // Check compliance requirements
    const missingRequirements = profile.compliance.requirements.filter(
      (r) => r.status === 'missing' || r.status === 'expired'
    );
    if (missingRequirements.length > 0) {
      blockers.push(
        `${missingRequirements.length} compliance requirement(s) missing or expired`
      );
      nextSteps.push(
        ...missingRequirements.map((r) => `Complete: ${r.name}`)
      );
    }

    // Check trust score threshold (role-specific)
    const minTrustScores: Record<RoleType, number> = {
      [RoleType.CLINICIAN]: 0.7,
      [RoleType.NURSE]: 0.65,
      [RoleType.FACULTY]: 0.75,
      [RoleType.RESEARCHER]: 0.7,
      [RoleType.ADMINISTRATOR]: 0.6,
      [RoleType.PRECEPTOR]: 0.75,
      [RoleType.TELEMEDICINE]: 0.7,
      [RoleType.MULTI_FACILITY]: 0.75,
    };

    if (profile.trustScore < minTrustScores[roleType]) {
      blockers.push(
        `Trust score ${(profile.trustScore * 100).toFixed(0)}% below minimum ${(minTrustScores[roleType] * 100).toFixed(0)}%`
      );
      nextSteps.push('Improve trust score by adding credentials or evidence');
    }

    return {
      canActivate: blockers.length === 0,
      blockers,
      nextSteps,
    };
  }
}

// Singleton instance
export const roleEngine = new RoleEngine();

