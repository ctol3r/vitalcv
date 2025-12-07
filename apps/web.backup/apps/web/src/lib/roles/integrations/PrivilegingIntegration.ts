/**
 * Privileging Integration
 * Phase 5: Integrate roles with Privileging Engine
 */

import { RoleType } from '../RoleEngine';
import { rolePermissionsEngine } from '../RolePermissionsEngine';

/**
 * Get privileging differences between faculty and clinician
 */
export function getRolePrivilegingDifferences(
  roleType: RoleType
): {
  facultyPrivileges: string[];
  clinicianPrivileges: string[];
  differences: string[];
} {
  const facultyScope = rolePermissionsEngine.getScopeOfRole(RoleType.FACULTY);
  const clinicianScope = rolePermissionsEngine.getScopeOfRole(RoleType.CLINICIAN);
  const currentScope = rolePermissionsEngine.getScopeOfRole(roleType);

  const facultyPrivileges = [
    ...facultyScope.allowedProcedures,
    ...facultyScope.allowedEducationalTasks,
    ...facultyScope.allowedSupervisionTasks,
  ];

  const clinicianPrivileges = [
    ...clinicianScope.allowedProcedures,
    ...clinicianScope.allowedEducationalTasks,
    ...clinicianScope.allowedSupervisionTasks,
  ];

  const currentPrivileges = [
    ...currentScope.allowedProcedures,
    ...currentScope.allowedEducationalTasks,
    ...currentScope.allowedSupervisionTasks,
  ];

  // Find differences
  const differences: string[] = [];
  if (roleType === RoleType.FACULTY) {
    const uniqueToFaculty = facultyPrivileges.filter(
      (p) => !clinicianPrivileges.includes(p)
    );
    differences.push(...uniqueToFaculty);
  } else if (roleType === RoleType.CLINICIAN) {
    const uniqueToClinician = clinicianPrivileges.filter(
      (p) => !facultyPrivileges.includes(p)
    );
    differences.push(...uniqueToClinician);
  }

  return {
    facultyPrivileges,
    clinicianPrivileges,
    differences,
  };
}

/**
 * Get privilege visibility per role
 */
export function getPrivilegeVisibility(roleType: RoleType, privilege: string): boolean {
  return rolePermissionsEngine.isPrivilegeVisible(roleType, privilege);
}

