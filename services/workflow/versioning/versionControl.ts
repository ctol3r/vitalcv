/**
 * Workflow Version Control Service
 *
 * Enables saving multiple versions of a workflow definition.
 * Supports restoring and diffing versions.
 */

import type { WorkflowDefinition, WorkflowVersion } from '../../../apps/web/src/types/workflow'

export interface VersionDiff {
  added: string[]
  removed: string[]
  modified: string[]
  changes: Array<{
    field: string
    oldValue: any
    newValue: any
  }>
}

export class WorkflowVersionControl {
  private versions: Map<string, WorkflowVersion[]> = new Map()

  /**
   * Save a new version of a workflow
   */
  saveVersion(
    workflowId: string,
    definition: WorkflowDefinition,
    createdBy: string,
    changeDescription?: string
  ): WorkflowVersion {
    const existingVersions = this.versions.get(workflowId) || []
    const nextVersion = existingVersions.length > 0
      ? Math.max(...existingVersions.map(v => v.version)) + 1
      : 1

    const version: WorkflowVersion = {
      id: `version-${workflowId}-${nextVersion}`,
      workflowId,
      version: nextVersion,
      definition: JSON.parse(JSON.stringify(definition)), // Deep clone
      createdAt: new Date().toISOString(),
      createdBy,
      changeDescription,
    }

    existingVersions.push(version)
    this.versions.set(workflowId, existingVersions)

    return version
  }

  /**
   * Get all versions for a workflow
   */
  getVersions(workflowId: string): WorkflowVersion[] {
    return this.versions.get(workflowId) || []
  }

  /**
   * Get a specific version
   */
  getVersion(workflowId: string, version: number): WorkflowVersion | null {
    const versions = this.versions.get(workflowId) || []
    return versions.find(v => v.version === version) || null
  }

  /**
   * Get the latest version
   */
  getLatestVersion(workflowId: string): WorkflowVersion | null {
    const versions = this.versions.get(workflowId) || []
    if (versions.length === 0) return null
    return versions[versions.length - 1]
  }

  /**
   * Restore a workflow to a specific version
   */
  restoreVersion(workflowId: string, version: number): WorkflowDefinition {
    const versionData = this.getVersion(workflowId, version)
    if (!versionData) {
      throw new Error(`Version ${version} not found for workflow ${workflowId}`)
    }
    return JSON.parse(JSON.stringify(versionData.definition)) // Deep clone
  }

  /**
   * Compare two versions and return differences
   */
  diffVersions(
    workflowId: string,
    version1: number,
    version2: number
  ): VersionDiff {
    const v1 = this.getVersion(workflowId, version1)
    const v2 = this.getVersion(workflowId, version2)

    if (!v1 || !v2) {
      throw new Error('One or both versions not found')
    }

    return this.compareDefinitions(v1.definition, v2.definition)
  }

  /**
   * Compare current definition with a specific version
   */
  diffWithVersion(
    current: WorkflowDefinition,
    workflowId: string,
    version: number
  ): VersionDiff {
    const versionData = this.getVersion(workflowId, version)
    if (!versionData) {
      throw new Error(`Version ${version} not found`)
    }
    return this.compareDefinitions(versionData.definition, current)
  }

  /**
   * Compare two workflow definitions
   */
  private compareDefinitions(def1: WorkflowDefinition, def2: WorkflowDefinition): VersionDiff {
    const diff: VersionDiff = {
      added: [],
      removed: [],
      modified: [],
      changes: [],
    }

    // Compare basic fields
    const fieldsToCompare: Array<keyof WorkflowDefinition> = [
      'name',
      'description',
      'status',
      'trigger',
    ]

    for (const field of fieldsToCompare) {
      const val1 = def1[field]
      const val2 = def2[field]
      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        diff.modified.push(field)
        diff.changes.push({
          field,
          oldValue: val1,
          newValue: val2,
        })
      }
    }

    // Compare steps
    const stepIds1 = new Set(def1.steps.map(s => s.id))
    const stepIds2 = new Set(def2.steps.map(s => s.id))

    // Added steps
    for (const stepId of stepIds2) {
      if (!stepIds1.has(stepId)) {
        diff.added.push(`step:${stepId}`)
      }
    }

    // Removed steps
    for (const stepId of stepIds1) {
      if (!stepIds2.has(stepId)) {
        diff.removed.push(`step:${stepId}`)
      }
    }

    // Modified steps
    for (const step2 of def2.steps) {
      const step1 = def1.steps.find(s => s.id === step2.id)
      if (step1 && JSON.stringify(step1) !== JSON.stringify(step2)) {
        diff.modified.push(`step:${step2.id}`)
        diff.changes.push({
          field: `step:${step2.id}`,
          oldValue: step1,
          newValue: step2,
        })
      }
    }

    return diff
  }

  /**
   * Delete a version (soft delete - mark as deleted)
   */
  deleteVersion(workflowId: string, version: number): boolean {
    const versions = this.versions.get(workflowId) || []
    const index = versions.findIndex(v => v.version === version)
    if (index >= 0) {
      versions.splice(index, 1)
      this.versions.set(workflowId, versions)
      return true
    }
    return false
  }
}

// Singleton instance
export const workflowVersionControl = new WorkflowVersionControl()
