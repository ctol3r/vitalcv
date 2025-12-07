/**
 * Compliance Integration
 * Phase 5: Integrate roles with Compliance To-Do Engine
 */

import { RoleType } from '../RoleEngine';
import { credentialFilterEngine } from '../CredentialFilterEngine';
import { rolePermissionsEngine } from '../RolePermissionsEngine';

/**
 * Get role-specific compliance tasks
 */
export function getRoleComplianceTasks(
  roleType: RoleType,
  allTasks: any[]
): any[] {
  // Filter tasks to only show those relevant to the role
  return allTasks.filter((task) => {
    // Check if task is role-specific
    if (task.roleTypes && !task.roleTypes.includes(roleType)) {
      return false;
    }

    // Check if task requires permissions the role has
    if (task.requiredPermission) {
      if (!rolePermissionsEngine.canPerformAction(roleType, task.requiredPermission as any)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get role-specific compliance alerts
 */
export function getRoleComplianceAlerts(
  roleType: RoleType,
  credentials: any[]
): Array<{ severity: string; message: string }> {
  return credentialFilterEngine.getRoleComplianceAlerts(roleType, credentials);
}

