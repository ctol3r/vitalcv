/**
 * Skills Integration
 * Phase 5: Integrate roles with Skill Engine
 */

import { RoleType, roleEngine } from '../RoleEngine';

/**
 * Get role-specific competency map
 */
export function getRoleCompetencyMap(
  roleType: RoleType,
  allSkills: any[]
): Record<string, number> {
  const profile = roleEngine.getRoleProfile('', roleType); // Would need actual DID
  if (!profile) {
    return {};
  }

  // Filter skills to only show those relevant to the role
  const roleSkills = allSkills.filter((skill) => {
    // Check if skill is relevant to role
    const roleRelevantSkills: Record<RoleType, string[]> = {
      [RoleType.CLINICIAN]: ['patient_care', 'diagnosis', 'treatment', 'prescription'],
      [RoleType.NURSE]: ['patient_care', 'medication_administration', 'assessment'],
      [RoleType.FACULTY]: ['teaching', 'curriculum_design', 'evaluation'],
      [RoleType.RESEARCHER]: ['research_methodology', 'data_analysis', 'grant_writing'],
      [RoleType.ADMINISTRATOR]: ['leadership', 'policy_management', 'compliance'],
      [RoleType.PRECEPTOR]: ['supervision', 'teaching', 'evaluation'],
      [RoleType.TELEMEDICINE]: ['telemedicine', 'remote_care', 'technology'],
      [RoleType.MULTI_FACILITY]: ['cross_facility_care', 'credentialing', 'coordination'],
    };

    const relevant = roleRelevantSkills[roleType] || [];
    return relevant.some((r) => skill.category?.includes(r));
  });

  // Build competency map from role skills
  const competencyMap: Record<string, number> = {};
  roleSkills.forEach((skill) => {
    competencyMap[skill.name] = skill.confidence || 0;
  });

  return competencyMap;
}

