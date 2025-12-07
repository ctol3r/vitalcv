/**
 * Facility Privileging Engine - Evaluation Service
 * Phase 2: Privilege Eligibility Evaluation
 *
 * Main service that orchestrates privilege evaluation
 */

import { PrivilegeEngine } from './PrivilegeEngine';
import { PrivilegeRequirementEngine } from './PrivilegeRequirementEngine';
import type {
  ClinicianProfile,
  Privilege,
  PrivilegeEligibilityResult,
  PrivilegeStatus,
} from './models';

export class PrivilegeEvaluationService {
  private privilegeEngine: PrivilegeEngine;
  private requirementEngine: PrivilegeRequirementEngine;

  constructor() {
    this.privilegeEngine = new PrivilegeEngine();
    this.requirementEngine = new PrivilegeRequirementEngine();
  }

  /**
   * Evaluate eligibility for a single privilege
   * Phase 2: Multi-factor eligibility evaluation
   */
  evaluateEligibility(
    privilege: Privilege,
    profile: ClinicianProfile
  ): PrivilegeEligibilityResult {
    // Verify all requirements
    const requirements = this.requirementEngine.verifyRequirements(privilege, profile);

    // Calculate confidence score
    const confidenceScore = this.privilegeEngine.calculateConfidenceScore(
      privilege,
      profile,
      requirements
    );

    // Map risk score
    const riskScore = this.requirementEngine.mapRiskScore(
      privilege,
      requirements,
      profile
    );

    // Identify blockers
    const blockers = this.extractBlockers(requirements, profile);

    // Determine status
    const status = this.privilegeEngine.determineStatus(
      requirements,
      confidenceScore,
      blockers
    );

    // Generate next steps
    const nextSteps = this.privilegeEngine.generateNextSteps(privilege, requirements);

    // Determine conditions for conditional status
    const conditions = status === PrivilegeStatus.Conditional
      ? this.generateConditions(requirements, confidenceScore)
      : undefined;

    return {
      privilege,
      status,
      confidenceScore,
      requirements,
      riskScore,
      nextSteps,
      blockers,
      conditions,
    };
  }

  /**
   * Evaluate eligibility for multiple privileges
   */
  evaluateMultiple(
    privileges: Privilege[],
    profile: ClinicianProfile
  ): PrivilegeEligibilityResult[] {
    return privileges.map((privilege) => this.evaluateEligibility(privilege, profile));
  }

  /**
   * Get privileges for a clinician based on their profile
   * Phase 1: Mapping clinicianProfile → privilegeSet
   */
  getPrivilegesForClinician(clinicianId: string): Privilege[] {
    return this.privilegeEngine.getPrivilegeSetForClinician(clinicianId);
  }

  /**
   * Link skills to privileges
   * Phase 2: Skill → Privilege linking
   */
  linkSkillsToPrivileges(
    skills: string[],
    privileges: Privilege[]
  ): Map<string, Privilege[]> {
    const skillToPrivileges = new Map<string, Privilege[]>();

    for (const skill of skills) {
      const linkedPrivileges = privileges.filter((privilege) =>
        privilege.requiredSkills.includes(skill)
      );
      if (linkedPrivileges.length > 0) {
        skillToPrivileges.set(skill, linkedPrivileges);
      }
    }

    return skillToPrivileges;
  }

  /**
   * Check if attestation score meets threshold
   * Phase 2: requiredAttestationScore threshold
   */
  checkAttestationScore(
    profile: ClinicianProfile,
    requiredAttestations: string[],
    threshold: number = 80
  ): { meetsThreshold: boolean; score: number; missing: string[] } {
    const attestationScores = requiredAttestations.map((req) => {
      const attestation = profile.attestations.find((a) => a.type === req);
      if (!attestation) return 0;

      // Check expiration
      const isExpired = attestation.expiresAt
        ? new Date(attestation.expiresAt) < new Date()
        : false;
      if (isExpired) return 0;

      // Score based on recency (more recent = higher score)
      const daysSince = attestation.expiresAt
        ? (new Date(attestation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        : 365;
      const recencyScore = Math.min(100, Math.max(0, daysSince / 3.65)); // Scale to 0-100

      return recencyScore;
    });

    const avgScore = attestationScores.reduce((sum, score) => sum + score, 0) / attestationScores.length || 0;
    const missing = requiredAttestations.filter(
      (req, idx) => attestationScores[idx] === 0
    );

    return {
      meetsThreshold: avgScore >= threshold,
      score: Math.round(avgScore),
      missing,
    };
  }

  /**
   * Apply board-cert exceptions
   * Phase 2: Board-cert exceptions (e.g., Family Medicine → Urgent Care privileges)
   */
  applyBoardCertExceptions(
    privilege: Privilege,
    profile: ClinicianProfile
  ): { exceptionApplied: boolean; reason?: string } {
    // Example: Family Medicine can get Urgent Care privileges
    if (
      profile.specialties.includes('Family Medicine') &&
      privilege.facilityUnits.includes('Urgent Care')
    ) {
      return {
        exceptionApplied: true,
        reason: 'Family Medicine board certification grants Urgent Care privileges',
      };
    }

    // Example: Emergency Medicine can get Urgent Care privileges
    if (
      profile.specialties.includes('Emergency Medicine') &&
      privilege.facilityUnits.includes('Urgent Care')
    ) {
      return {
        exceptionApplied: true,
        reason: 'Emergency Medicine board certification grants Urgent Care privileges',
      };
    }

    return { exceptionApplied: false };
  }

  /**
   * Real-time validation on skill logs
   * Phase 2: Real-time validation on skill logs
   */
  validateSkillLogs(
    skillName: string,
    profile: ClinicianProfile,
    minCompetencyScore: number = 80
  ): { valid: boolean; score?: number; issues: string[] } {
    const skill = profile.skills.find((s) => s.name === skillName);

    if (!skill) {
      return {
        valid: false,
        issues: [`Skill ${skillName} not found in profile`],
      };
    }

    if (!skill.verified) {
      return {
        valid: false,
        issues: [`Skill ${skillName} not verified`],
      };
    }

    const score = skill.competencyScore || 0;
    if (score < minCompetencyScore) {
      return {
        valid: false,
        score,
        issues: [`Skill competency score ${score} below minimum ${minCompetencyScore}`],
      };
    }

    return {
      valid: true,
      score,
      issues: [],
    };
  }

  /**
   * Calculate risk amplifier
   * Phase 2: riskAmplifier logic (sanctions, chain drift, expiring evidence)
   */
  calculateRiskAmplifier(profile: ClinicianProfile): number {
    let amplifier = 1.0;

    // Sanctions amplify risk
    const hasSanctions = profile.riskFactors.some((factor) =>
      factor.toLowerCase().includes('sanction')
    );
    if (hasSanctions) amplifier *= 1.5;

    // Chain drift amplifies risk
    const staleAnchors = profile.chainAnchors.filter((anchor) => {
      const anchorDate = new Date(anchor.timestamp);
      const daysSince = (Date.now() - anchorDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 90;
    });
    if (staleAnchors.length > 0) amplifier *= 1.2;

    // Expiring evidence amplifies risk
    const expiringCredentials = profile.credentials.filter((c) => {
      if (!c.expiresAt) return false;
      const daysUntilExpiry =
        (new Date(c.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry < 45;
    });
    if (expiringCredentials.length > 0) amplifier *= 1.1;

    return amplifier;
  }

  /**
   * Extract blockers from requirements
   */
  private extractBlockers(
    requirements: Array<{ blockers?: string[] }>,
    profile: ClinicianProfile
  ): string[] {
    const blockers: string[] = [];

    // Collect blockers from requirements
    for (const req of requirements) {
      if (req.blockers) {
        blockers.push(...req.blockers);
      }
    }

    // Add risk factors as blockers
    blockers.push(...profile.riskFactors);

    return [...new Set(blockers)]; // Remove duplicates
  }

  /**
   * Generate conditions for conditional status
   */
  private generateConditions(
    requirements: Array<{ verified: boolean; identifier: string; type: string }>,
    confidenceScore: number
  ): string[] {
    const conditions: string[] = [];

    const unverified = requirements.filter((r) => !r.verified);
    if (unverified.length > 0) {
      conditions.push(
        `Complete verification for: ${unverified.map((r) => r.identifier).join(', ')}`
      );
    }

    if (confidenceScore < 90) {
      conditions.push(`Improve confidence score from ${confidenceScore} to 90+`);
    }

    return conditions;
  }
}

