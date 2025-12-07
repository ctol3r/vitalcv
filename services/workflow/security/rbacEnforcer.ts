/**
 * B236B-WF-019: WorkflowRBACEnforcer
 *
 * Enforces role-based permissions for creating, editing, and executing workflows.
 * Checks user roles and scopes before actions.
 * Integrates with existing access control.
 */

import { getServiceLogger } from '../../logging/serviceLogger';
import {
  WorkflowDefinition,
  WorkflowExecutionContext,
} from '../models/types.js';

const log = getServiceLogger('workflow/security/rbac');

/**
 * User context for RBAC checks
 */
export interface UserContext {
  userId: string;
  roles: string[];
  orgId?: string;
  scopes?: string[];
}

/**
 * Permission types
 */
export enum WorkflowPermission {
  CREATE = 'workflow:create',
  READ = 'workflow:read',
  UPDATE = 'workflow:update',
  DELETE = 'workflow:delete',
  EXECUTE = 'workflow:execute',
  MANAGE = 'workflow:manage', // Full access
}

/**
 * WorkflowRBACEnforcer enforces role-based access control
 */
export class WorkflowRBACEnforcer {
  /**
   * Check if user can create workflows
   */
  canCreate(user: UserContext): boolean {
    return this.hasPermission(user, WorkflowPermission.CREATE) ||
           this.hasPermission(user, WorkflowPermission.MANAGE);
  }

  /**
   * Check if user can read a workflow
   */
  canRead(user: UserContext, workflow: WorkflowDefinition): boolean {
    // Users can always read workflows they created
    if (workflow.metadata?.createdBy === user.userId) {
      return true;
    }

    // Check org-level access
    if (workflow.metadata?.orgId && user.orgId === workflow.metadata.orgId) {
      return this.hasPermission(user, WorkflowPermission.READ) ||
             this.hasPermission(user, WorkflowPermission.MANAGE);
    }

    // Check global permissions
    return this.hasPermission(user, WorkflowPermission.READ) ||
           this.hasPermission(user, WorkflowPermission.MANAGE);
  }

  /**
   * Check if user can update a workflow
   */
  canUpdate(user: UserContext, workflow: WorkflowDefinition): boolean {
    // Users can always update workflows they created
    if (workflow.metadata?.createdBy === user.userId) {
      return true;
    }

    // Check org-level access
    if (workflow.metadata?.orgId && user.orgId === workflow.metadata.orgId) {
      return this.hasPermission(user, WorkflowPermission.UPDATE) ||
             this.hasPermission(user, WorkflowPermission.MANAGE);
    }

    // Check global permissions
    return this.hasPermission(user, WorkflowPermission.UPDATE) ||
           this.hasPermission(user, WorkflowPermission.MANAGE);
  }

  /**
   * Check if user can delete a workflow
   */
  canDelete(user: UserContext, workflow: WorkflowDefinition): boolean {
    // Users can always delete workflows they created
    if (workflow.metadata?.createdBy === user.userId) {
      return true;
    }

    // Check org-level access
    if (workflow.metadata?.orgId && user.orgId === workflow.metadata.orgId) {
      return this.hasPermission(user, WorkflowPermission.DELETE) ||
             this.hasPermission(user, WorkflowPermission.MANAGE);
    }

    // Check global permissions
    return this.hasPermission(user, WorkflowPermission.DELETE) ||
           this.hasPermission(user, WorkflowPermission.MANAGE);
  }

  /**
   * Check if user can execute a workflow
   */
  canExecute(user: UserContext, workflow: WorkflowDefinition): boolean {
    // Check if workflow is enabled
    if (!workflow.enabled) {
      log.warn('Workflow execution denied: workflow disabled', {
        userId: user.userId,
        workflowId: workflow.id,
      });
      return false;
    }

    // Check org-level access
    if (workflow.metadata?.orgId && user.orgId !== workflow.metadata.orgId) {
      log.warn('Workflow execution denied: org mismatch', {
        userId: user.userId,
        workflowId: workflow.id,
        userOrgId: user.orgId,
        workflowOrgId: workflow.metadata.orgId,
      });
      return false;
    }

    // Check permissions
    const hasPermission = this.hasPermission(user, WorkflowPermission.EXECUTE) ||
                          this.hasPermission(user, WorkflowPermission.MANAGE);

    if (!hasPermission) {
      log.warn('Workflow execution denied: insufficient permissions', {
        userId: user.userId,
        workflowId: workflow.id,
        userRoles: user.roles,
      });
    }

    return hasPermission;
  }

  /**
   * Enforce permission check and throw if not allowed
   */
  enforceCreate(user: UserContext): void {
    if (!this.canCreate(user)) {
      throw new Error('Insufficient permissions to create workflows');
    }
  }

  /**
   * Enforce permission check and throw if not allowed
   */
  enforceRead(user: UserContext, workflow: WorkflowDefinition): void {
    if (!this.canRead(user, workflow)) {
      throw new Error('Insufficient permissions to read workflow');
    }
  }

  /**
   * Enforce permission check and throw if not allowed
   */
  enforceUpdate(user: UserContext, workflow: WorkflowDefinition): void {
    if (!this.canUpdate(user, workflow)) {
      throw new Error('Insufficient permissions to update workflow');
    }
  }

  /**
   * Enforce permission check and throw if not allowed
   */
  enforceDelete(user: UserContext, workflow: WorkflowDefinition): void {
    if (!this.canDelete(user, workflow)) {
      throw new Error('Insufficient permissions to delete workflow');
    }
  }

  /**
   * Enforce permission check and throw if not allowed
   */
  enforceExecute(user: UserContext, workflow: WorkflowDefinition): void {
    if (!this.canExecute(user, workflow)) {
      throw new Error('Insufficient permissions to execute workflow');
    }
  }

  /**
   * Check if user has a specific permission
   */
  private hasPermission(user: UserContext, permission: WorkflowPermission): boolean {
    // Check roles
    const rolePermissions: Record<string, WorkflowPermission[]> = {
      'admin': [WorkflowPermission.MANAGE],
      'workflow_admin': [
        WorkflowPermission.CREATE,
        WorkflowPermission.READ,
        WorkflowPermission.UPDATE,
        WorkflowPermission.DELETE,
        WorkflowPermission.EXECUTE,
      ],
      'workflow_editor': [
        WorkflowPermission.CREATE,
        WorkflowPermission.READ,
        WorkflowPermission.UPDATE,
        WorkflowPermission.EXECUTE,
      ],
      'workflow_viewer': [
        WorkflowPermission.READ,
        WorkflowPermission.EXECUTE,
      ],
    };

    for (const role of user.roles) {
      const permissions = rolePermissions[role];
      if (permissions && permissions.includes(permission)) {
        return true;
      }
    }

    // Check scopes if provided
    if (user.scopes) {
      const scopePermission = permission.replace('workflow:', '');
      if (user.scopes.includes(scopePermission) || user.scopes.includes('*')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract user context from workflow execution context
   */
  extractUserContext(context: WorkflowExecutionContext): UserContext | null {
    if (!context.userId) {
      return null;
    }

    return {
      userId: context.userId,
      roles: context.variables.userRoles || [],
      orgId: context.orgId,
      scopes: context.variables.userScopes,
    };
  }
}

