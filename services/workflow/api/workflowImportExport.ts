/**
 * WorkflowImportExport
 *
 * Provides API endpoints to export workflow definitions as JSON or DSL;
 * import workflows from uploaded files; validates and creates new versions
 */

import { z } from 'zod';
import type { WorkflowDefinition } from '../models/types';
import { WorkflowDefinitionSchema } from '../models/types';

export interface ExportOptions {
  format: 'json' | 'dsl'
  includeMetadata?: boolean
  includeVersions?: boolean
}

export interface ImportResult {
  success: boolean
  workflow?: WorkflowDefinition
  errors?: string[]
  warnings?: string[]
}

export class WorkflowImportExport {
  /**
   * Export workflow as JSON
   */
  exportAsJSON(definition: WorkflowDefinition, options: ExportOptions = { format: 'json' }): string {
    const exportData: any = {
      version: '1.0',
      workflow: {
        name: definition.name,
        description: definition.description,
        trigger: definition.trigger,
        steps: definition.steps,
      },
    }

    if (options.includeMetadata) {
      exportData.metadata = {
        id: definition.id,
        status: definition.status,
        version: definition.version,
        createdAt: definition.createdAt,
        updatedAt: definition.updatedAt,
        createdBy: definition.createdBy,
        organizationId: definition.organizationId,
      }
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Export workflow as DSL (Domain Specific Language)
   */
  exportAsDSL(definition: WorkflowDefinition): string {
    const lines: string[] = []

    lines.push(`workflow "${definition.name}"`)
    if (definition.description) {
      lines.push(`  description "${definition.description}"`)
    }
    lines.push('')

    // Trigger
    lines.push('trigger {')
    lines.push(`  type: ${definition.trigger.type}`)
    if (definition.trigger.cronExpression) {
      lines.push(`  cron: "${definition.trigger.cronExpression}"`)
    }
    if (definition.trigger.eventTypes && definition.trigger.eventTypes.length > 0) {
      lines.push(`  events: [${definition.trigger.eventTypes.map(e => `"${e}"`).join(', ')}]`)
    }
    if (definition.trigger.webhookUrl) {
      lines.push(`  webhook: "${definition.trigger.webhookUrl}"`)
    }
    lines.push('}')
    lines.push('')

    // Steps
    lines.push('steps {')
    definition.steps.forEach((step, index) => {
      lines.push(`  step "${step.name}" {`)
      lines.push(`    type: ${step.type}`)
      lines.push(`    action: "${step.action}"`)
      if (Object.keys(step.parameters).length > 0) {
        lines.push(`    parameters: ${JSON.stringify(step.parameters)}`)
      }
      if (step.conditions && step.conditions.length > 0) {
        lines.push('    conditions: [')
        step.conditions.forEach(condition => {
          lines.push(`      { field: "${condition.field}", operator: "${condition.operator}", value: ${JSON.stringify(condition.value)} }`)
        })
        lines.push('    ]')
      }
      lines.push('  }')
      if (index < definition.steps.length - 1) {
        lines.push('')
      }
    })
    lines.push('}')

    return lines.join('\n')
  }

  /**
   * Import workflow from JSON
   */
  importFromJSON(json: string): ImportResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const data = JSON.parse(json)

      if (!data.workflow) {
        errors.push('Invalid format: missing "workflow" field')
        return { success: false, errors }
      }

      const workflow = data.workflow

      // Validate required fields
      if (!workflow.name) {
        errors.push('Workflow name is required')
      }
      if (!workflow.trigger) {
        errors.push('Trigger configuration is required')
      }
      if (!workflow.steps || !Array.isArray(workflow.steps)) {
        errors.push('Steps array is required')
      }

      if (errors.length > 0) {
        return { success: false, errors }
      }

      // Validate trigger
      if (!workflow.trigger.type) {
        errors.push('Trigger type is required')
      }

      // Validate steps
      workflow.steps.forEach((step: any, index: number) => {
        if (!step.name) {
          errors.push(`Step ${index + 1}: name is required`)
        }
        if (!step.type) {
          errors.push(`Step ${index + 1}: type is required`)
        }
        if (!step.action) {
          errors.push(`Step ${index + 1}: action is required`)
        }
      })

      if (errors.length > 0) {
        return { success: false, errors }
      }

      // Create workflow definition
      const definition: WorkflowDefinition = {
        id: data.metadata?.id || `imported-${Date.now()}`,
        name: workflow.name,
        description: workflow.description,
        status: data.metadata?.status || 'draft',
        version: data.metadata?.version || 1,
        createdAt: data.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: data.metadata?.createdBy || 'imported',
        organizationId: data.metadata?.organizationId,
        trigger: workflow.trigger,
        steps: workflow.steps.map((step: any) => ({
          ...step,
          id: step.id || `step-${Date.now()}-${Math.random()}`,
          parameters: step.parameters || {},
          position: step.position || { x: 0, y: 0 },
        })),
        metadata: data.metadata?.metadata,
      }

      // Warnings
      if (!data.metadata) {
        warnings.push('No metadata found in import file')
      }
      if (definition.steps.length === 0) {
        warnings.push('Workflow has no steps')
      }

      return {
        success: true,
        workflow: definition,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    } catch (err: any) {
      return {
        success: false,
        errors: [`Failed to parse JSON: ${err.message}`],
      }
    }
  }

  /**
   * Import workflow from DSL (simplified parser)
   */
  importFromDSL(dsl: string): ImportResult {
    // This is a simplified DSL parser
    // In a production system, you'd use a proper parser library
    const errors: string[] = []
    errors.push('DSL import is not yet fully implemented. Please use JSON format.')
    return { success: false, errors }
  }

  /**
   * Validate workflow definition
   */
  validate(definition: WorkflowDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!definition.name || definition.name.trim().length === 0) {
      errors.push('Workflow name is required')
    }

    if (!definition.trigger) {
      errors.push('Trigger configuration is required')
    } else {
      if (!definition.trigger.type) {
        errors.push('Trigger type is required')
      }
      if (definition.trigger.type === 'event' && (!definition.trigger.eventTypes || definition.trigger.eventTypes.length === 0)) {
        errors.push('Event types are required for event triggers')
      }
      if (definition.trigger.type === 'cron' && !definition.trigger.cronExpression) {
        errors.push('Cron expression is required for cron triggers')
      }
      if (definition.trigger.type === 'webhook' && !definition.trigger.webhookUrl) {
        errors.push('Webhook URL is required for webhook triggers')
      }
    }

    if (!definition.steps || definition.steps.length === 0) {
      errors.push('At least one step is required')
    } else {
      definition.steps.forEach((step, index) => {
        if (!step.name || step.name.trim().length === 0) {
          errors.push(`Step ${index + 1}: name is required`)
        }
        if (!step.type) {
          errors.push(`Step ${index + 1}: type is required`)
        }
        if (!step.action || step.action.trim().length === 0) {
          errors.push(`Step ${index + 1}: action is required`)
        }
      })
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

// Singleton instance
export const workflowImportExport = new WorkflowImportExport()
