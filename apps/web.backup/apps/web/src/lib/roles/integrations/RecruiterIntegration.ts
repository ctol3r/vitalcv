/**
 * Recruiter Integration
 * Phase 5: Integrate roles with Recruiter Portal
 */

import { RoleType, roleEngine } from '../RoleEngine';
import { credentialFilterEngine } from '../CredentialFilterEngine';
import { roleUIEngine } from '../RoleUIEngine';

/**
 * Get candidate roles exposed cleanly for recruiters
 */
export function getCandidateRolesForRecruiter(
  did: string
): Array<{
  roleType: RoleType;
  displayName: string;
  trustScore: number;
  complianceScore: number;
  credentials: number;
  isActive: boolean;
}> {
  const profiles = roleEngine.getRoleProfiles(did);

  return profiles
    .filter((profile) => {
      // Only show roles that should be visible to recruiters
      // Recruiter mode is disabled for some roles
      return !roleUIEngine.isRecruiterModeDisabled(profile.roleType);
    })
    .map((profile) => {
      const metadata = roleEngine.getRoleMetadata(profile.roleType);
      const credentials = credentialFilterEngine.filterCredentialsByRole(
        [], // Would need actual credentials
        profile.roleType
      );

      return {
        roleType: profile.roleType,
        displayName: metadata.displayName,
        trustScore: profile.trustScore,
        complianceScore: profile.compliance.complianceScore,
        credentials: credentials.length,
        isActive: profile.isActive,
      };
    });
}

/**
 * Format role data for recruiter display
 */
export function formatRoleForRecruiter(roleType: RoleType, profile: any): {
  title: string;
  description: string;
  keyCredentials: string[];
  trustIndicator: 'high' | 'medium' | 'low';
} {
  const metadata = roleEngine.getRoleMetadata(roleType);
  const credentialTypes = credentialFilterEngine.getCredentialTypesForRole(roleType);
  const criticalTypes = credentialFilterEngine.getCredentialGapsForRole(
    roleType,
    [] // Would need actual credentials
  );

  const trustIndicator =
    profile.trustScore >= 0.8 ? 'high'
    : profile.trustScore >= 0.6 ? 'medium'
    : 'low';

  return {
    title: metadata.displayName,
    description: metadata.description,
    keyCredentials: credentialTypes.slice(0, 5), // Top 5 credentials
    trustIndicator,
  };
}

