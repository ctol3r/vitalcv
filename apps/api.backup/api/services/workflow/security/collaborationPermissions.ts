/**
 * Workflow Collaboration Permissions Service
 *
 * Implements sharing and collaboration on workflows.
 * Defines roles (owner/editor/viewer).
 * Allows inviting collaborators by email.
 * Enforces permissions in UI and backend.
 */

import type { WorkflowCollaborator } from '../../../apps/web/src/types/workflow'

export type CollaboratorRole = 'owner' | 'editor' | 'viewer'

export interface Permission {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canShare: boolean
  canExecute: boolean
}

export interface InviteCollaboratorRequest {
  workflowId: string
  email: string
  role: CollaboratorRole
  invitedBy: string
}

export class WorkflowCollaborationPermissions {
  private collaborators: Map<string, WorkflowCollaborator[]> = new Map()

  /**
   * Get permissions for a user on a workflow
   */
  getPermissions(workflowId: string, userId: string): Permission {
    const collaborators = this.collaborators.get(workflowId) || []
    const collaborator = collaborators.find(c => c.userId === userId)

    if (!collaborator) {
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canShare: false,
        canExecute: false,
      }
    }

    return this.getPermissionsForRole(collaborator.role)
  }

  /**
   * Get permissions for a role
   */
  private getPermissionsForRole(role: CollaboratorRole): Permission {
    switch (role) {
      case 'owner':
        return {
          canView: true,
          canEdit: true,
          canDelete: true,
          canShare: true,
          canExecute: true,
        }
      case 'editor':
        return {
          canView: true,
          canEdit: true,
          canDelete: false,
          canShare: true,
          canExecute: true,
        }
      case 'viewer':
        return {
          canView: true,
          canEdit: false,
          canDelete: false,
          canShare: false,
          canExecute: false,
        }
      default:
        return {
          canView: false,
          canEdit: false,
          canDelete: false,
          canShare: false,
          canExecute: false,
        }
    }
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(workflowId: string, userId: string, permission: keyof Permission): boolean {
    const permissions = this.getPermissions(workflowId, userId)
    return permissions[permission]
  }

  /**
   * Invite a collaborator to a workflow
   */
  inviteCollaborator(request: InviteCollaboratorRequest): WorkflowCollaborator {
    const collaborators = this.collaborators.get(request.workflowId) || []

    // Check if already invited
    const existing = collaborators.find(c => c.email === request.email)
    if (existing) {
      throw new Error(`User ${request.email} is already a collaborator`)
    }

    // Check if inviter has permission to share
    const inviterPermissions = this.getPermissions(request.workflowId, request.invitedBy)
    if (!inviterPermissions.canShare) {
      throw new Error('You do not have permission to invite collaborators')
    }

    const collaborator: WorkflowCollaborator = {
      id: `collab-${request.workflowId}-${Date.now()}`,
      workflowId: request.workflowId,
      userId: `user-${request.email}`, // In real app, resolve email to user ID
      email: request.email,
      role: request.role,
      invitedAt: new Date().toISOString(),
      invitedBy: request.invitedBy,
    }

    collaborators.push(collaborator)
    this.collaborators.set(request.workflowId, collaborators)

    return collaborator
  }

  /**
   * Remove a collaborator from a workflow
   */
  removeCollaborator(workflowId: string, collaboratorId: string, removedBy: string): boolean {
    const collaborators = this.collaborators.get(workflowId) || []
    const collaborator = collaborators.find(c => c.id === collaboratorId)

    if (!collaborator) {
      return false
    }

    // Check if remover has permission
    const removerPermissions = this.getPermissions(workflowId, removedBy)
    if (!removerPermissions.canShare && collaborator.userId !== removedBy) {
      throw new Error('You do not have permission to remove collaborators')
    }

    // Cannot remove yourself if you're the only owner
    if (collaborator.role === 'owner' && collaborator.userId === removedBy) {
      const ownerCount = collaborators.filter(c => c.role === 'owner').length
      if (ownerCount === 1) {
        throw new Error('Cannot remove the only owner')
      }
    }

    const filtered = collaborators.filter(c => c.id !== collaboratorId)
    this.collaborators.set(workflowId, filtered)

    return true
  }

  /**
   * Update collaborator role
   */
  updateCollaboratorRole(
    workflowId: string,
    collaboratorId: string,
    newRole: CollaboratorRole,
    updatedBy: string
  ): WorkflowCollaborator {
    const collaborators = this.collaborators.get(workflowId) || []
    const collaborator = collaborators.find(c => c.id === collaboratorId)

    if (!collaborator) {
      throw new Error('Collaborator not found')
    }

    // Check if updater has permission
    const updaterPermissions = this.getPermissions(workflowId, updatedBy)
    if (!updaterPermissions.canShare) {
      throw new Error('You do not have permission to update collaborator roles')
    }

    // Cannot change role of the only owner
    if (collaborator.role === 'owner' && newRole !== 'owner') {
      const ownerCount = collaborators.filter(c => c.role === 'owner').length
      if (ownerCount === 1) {
        throw new Error('Cannot change role of the only owner')
      }
    }

    collaborator.role = newRole
    this.collaborators.set(workflowId, collaborators)

    return collaborator
  }

  /**
   * Get all collaborators for a workflow
   */
  getCollaborators(workflowId: string): WorkflowCollaborator[] {
    return this.collaborators.get(workflowId) || []
  }

  /**
   * Check if user is a collaborator
   */
  isCollaborator(workflowId: string, userId: string): boolean {
    const collaborators = this.collaborators.get(workflowId) || []
    return collaborators.some(c => c.userId === userId)
  }

  /**
   * Get collaborator by user ID
   */
  getCollaborator(workflowId: string, userId: string): WorkflowCollaborator | null {
    const collaborators = this.collaborators.get(workflowId) || []
    return collaborators.find(c => c.userId === userId) || null
  }

  /**
   * Initialize workflow with owner
   */
  initializeWorkflow(workflowId: string, ownerId: string, ownerEmail: string): WorkflowCollaborator {
    const collaborator: WorkflowCollaborator = {
      id: `collab-${workflowId}-owner`,
      workflowId,
      userId: ownerId,
      email: ownerEmail,
      role: 'owner',
      invitedAt: new Date().toISOString(),
      invitedBy: ownerId,
    }

    this.collaborators.set(workflowId, [collaborator])
    return collaborator
  }
}

// Singleton instance
export const workflowCollaborationPermissions = new WorkflowCollaborationPermissions()
