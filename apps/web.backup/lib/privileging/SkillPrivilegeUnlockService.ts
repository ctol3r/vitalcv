/**
 * Facility Privileging Engine - Skill-Based Privilege Unlocks
 * Phase 5: Skill-based privilege unlocks (verified skills auto-unlock privileges)
 */

import type { ClinicianProfile, Privilege } from './models';
import { PrivilegeEvaluationService } from './PrivilegeEvaluationService';

export class SkillPrivilegeUnlockService {
  private evaluationService: PrivilegeEvaluationService;

  constructor() {
    this.evaluationService = new PrivilegeEvaluationService();
  }

  /**
   * Get privileges that can be auto-unlocked based on verified skills
   * Phase 5: Skill-based privilege unlocks
   */
  getAutoUnlockablePrivileges(
    profile: ClinicianProfile,
    availablePrivileges: Privilege[]
  ): Array<{ privilege: Privilege; reason: string; confidence: number }> {
    const unlockable: Array<{ privilege: Privilege; reason: string; confidence: number }> = [];

    const verifiedSkills = profile.skills
      .filter((s) => s.verified)
      .map((s) => s.name);

    for (const privilege of availablePrivileges) {
      // Check if all required skills are verified
      const requiredSkills = privilege.requiredSkills;
      const hasAllSkills = requiredSkills.every((skill) => verifiedSkills.includes(skill));

      if (hasAllSkills && requiredSkills.length > 0) {
        // Calculate confidence based on skill competency scores
        const skillScores = requiredSkills.map((skillName) => {
          const skill = profile.skills.find((s) => s.name === skillName && s.verified);
          return skill?.competencyScore || 80;
        });

        const avgCompetency = skillScores.reduce((sum, score) => sum + score, 0) / skillScores.length;
        const confidence = Math.min(100, Math.round(avgCompetency));

        unlockable.push({
          privilege,
          reason: `All required skills verified: ${requiredSkills.join(', ')}`,
          confidence,
        });
      }
    }

    return unlockable;
  }

  /**
   * Check if a privilege can be auto-unlocked
   */
  canAutoUnlock(privilege: Privilege, profile: ClinicianProfile): {
    canUnlock: boolean;
    reason?: string;
    missingSkills?: string[];
  } {
    const requiredSkills = privilege.requiredSkills;
    const verifiedSkills = profile.skills
      .filter((s) => s.verified)
      .map((s) => s.name);

    const missingSkills = requiredSkills.filter((skill) => !verifiedSkills.includes(skill));

    if (missingSkills.length === 0 && requiredSkills.length > 0) {
      return {
        canUnlock: true,
        reason: 'All required skills are verified',
      };
    }

    return {
      canUnlock: false,
      reason: 'Not all required skills are verified',
      missingSkills,
    };
  }

  /**
   * Auto-unlock privileges based on verified skills
   */
  autoUnlockPrivileges(
    profile: ClinicianProfile,
    availablePrivileges: Privilege[]
  ): Array<{ privilege: Privilege; unlocked: boolean; reason: string }> {
    const results: Array<{ privilege: Privilege; unlocked: boolean; reason: string }> = [];

    for (const privilege of availablePrivileges) {
      const unlockCheck = this.canAutoUnlock(privilege, profile);

      results.push({
        privilege,
        unlocked: unlockCheck.canUnlock,
        reason: unlockCheck.reason || 'Cannot auto-unlock',
      });
    }

    return results;
  }

  /**
   * Get skill recommendations to unlock a specific privilege
   */
  getSkillRecommendationsForPrivilege(
    privilege: Privilege,
    profile: ClinicianProfile
  ): Array<{ skill: string; status: 'verified' | 'missing' | 'in_progress'; action: string }> {
    const recommendations: Array<{ skill: string; status: 'verified' | 'missing' | 'in_progress'; action: string }> = [];

    for (const requiredSkill of privilege.requiredSkills) {
      const skill = profile.skills.find((s) => s.name === requiredSkill);

      if (skill?.verified) {
        recommendations.push({
          skill: requiredSkill,
          status: 'verified',
          action: 'No action needed - skill is verified',
        });
      } else if (skill && !skill.verified) {
        recommendations.push({
          skill: requiredSkill,
          status: 'in_progress',
          action: 'Complete skill verification process',
        });
      } else {
        recommendations.push({
          skill: requiredSkill,
          status: 'missing',
          action: `Obtain training and verification for: ${requiredSkill}`,
        });
      }
    }

    return recommendations;
  }
}
