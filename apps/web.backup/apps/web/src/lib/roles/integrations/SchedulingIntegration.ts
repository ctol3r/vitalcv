/**
 * Scheduling Integration
 * Phase 5: Integrate roles with Scheduling Engine
 */

import { RoleType, roleEngine } from '../RoleEngine';
import { rolePermissionsEngine } from '../RolePermissionsEngine';

/**
 * Get role eligibility for scheduling
 */
export function getRoleSchedulingEligibility(
  roleType: RoleType,
  shiftRequirements: any
): {
  eligible: boolean;
  reasons: string[];
  restrictions: string[];
} {
  const scope = rolePermissionsEngine.getScopeOfRole(roleType);
  const permissions = rolePermissionsEngine.getRolePermissions(roleType);

  const reasons: string[] = [];
  const restrictions: string[] = [];

  // Check if role can view shifts
  if (!permissions.allowedActions.includes('view_shifts')) {
    restrictions.push('Role cannot view shifts');
  }

  // Check if role can schedule shifts
  if (!permissions.allowedActions.includes('schedule_shift')) {
    restrictions.push('Role cannot schedule shifts');
  }

  // Check scope of practice matches shift requirements
  if (shiftRequirements.allowedProcedures) {
    const hasMatchingProcedure = shiftRequirements.allowedProcedures.some((proc: string) =>
      scope.allowedProcedures.includes(proc)
    );
    if (!hasMatchingProcedure) {
      restrictions.push('Role scope does not match shift requirements');
    }
  }

  return {
    eligible: restrictions.length === 0,
    reasons,
    restrictions,
  };
}

/**
 * Map role to scheduling eligibility
 */
export function mapRoleToScheduling(roleType: RoleType): {
  canViewShifts: boolean;
  canScheduleShifts: boolean;
  canManageShifts: boolean;
} {
  const permissions = rolePermissionsEngine.getRolePermissions(roleType);

  return {
    canViewShifts: permissions.allowedActions.includes('view_shifts'),
    canScheduleShifts: permissions.allowedActions.includes('schedule_shift'),
    canManageShifts: permissions.allowedActions.includes('manage_team'),
  };
}

