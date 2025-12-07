/**
 * Growth Engine Integration
 * Phase 5: Integrate roles with Growth Engine
 */

import { RoleType } from '../RoleEngine';
import { credentialFilterEngine } from '../CredentialFilterEngine';

/**
 * Filter growth recommendations by role
 */
export function filterGrowthByRole(
  recommendations: any[],
  roleType: RoleType
): any[] {
  // Filter recommendations to only show those relevant to the role
  return recommendations.filter((rec) => {
    // Check if recommendation is role-specific
    if (rec.roleTypes && !rec.roleTypes.includes(roleType)) {
      return false;
    }

    // Check if recommendation requires credentials visible to this role
    if (rec.requiredCredentials) {
      const visible = rec.requiredCredentials.some((credType: string) =>
        credentialFilterEngine.isCredentialVisibleForRole(
          { type: credType } as any,
          roleType
        )
      );
      if (!visible) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get role-specific career growth insights
 */
export function getRoleGrowthInsights(roleType: RoleType, data: any): {
  nextSteps: string[];
  opportunities: string[];
  skillGaps: string[];
} {
  const credentialTypes = credentialFilterEngine.getCredentialTypesForRole(roleType);
  const gaps = credentialFilterEngine.getCredentialGapsForRole(roleType, data.credentials || []);

  return {
    nextSteps: gaps.map((gap) => `Obtain ${gap} credential`),
    opportunities: [
      `Explore ${roleType} career advancement`,
      'Complete role-specific certifications',
    ],
    skillGaps: gaps,
  };
}

