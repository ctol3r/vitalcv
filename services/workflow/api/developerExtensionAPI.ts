/**
 * Developer Extension API Service
 *
 * Allows developers to register new actions and triggers programmatically.
 * Validates code signatures.
 * Adds registry entries.
 * Documentation and examples included.
 */

import type { ActionRegistry, ActionParameter, ActionType } from '../../../apps/web/src/types/workflow'

export interface RegisterActionRequest {
  id: string
  name: string
  description: string
  type: ActionType
  parameters: ActionParameter[]
  codeSignature?: string
  handler?: string // URL or function name
  registeredBy: string
}

export interface RegisterTriggerRequest {
  id: string
  name: string
  description: string
  type: string
  configurationSchema: Record<string, any>
  registeredBy: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class DeveloperExtensionAPI {
  private actionRegistry: Map<string, ActionRegistry> = new Map()
  private triggerRegistry: Map<string, RegisterTriggerRequest> = new Map()

  /**
   * Register a new action
   */
  registerAction(request: RegisterActionRequest): ActionRegistry {
    // Validate request
    const validation = this.validateActionRequest(request)
    if (!validation.valid) {
      throw new Error(`Invalid action registration: ${validation.errors.join(', ')}`)
    }

    // Check if already registered
    if (this.actionRegistry.has(request.id)) {
      throw new Error(`Action with ID "${request.id}" is already registered`)
    }

    // Validate code signature if provided
    if (request.codeSignature) {
      const signatureValidation = this.validateCodeSignature(request.codeSignature)
      if (!signatureValidation.valid) {
        throw new Error(`Invalid code signature: ${signatureValidation.errors.join(', ')}`)
      }
    }

    const registry: ActionRegistry = {
      id: request.id,
      name: request.name,
      description: request.description,
      type: request.type,
      parameters: request.parameters,
      codeSignature: request.codeSignature,
      registeredBy: request.registeredBy,
      registeredAt: new Date().toISOString(),
    }

    this.actionRegistry.set(request.id, registry)
    return registry
  }

  /**
   * Register a new trigger type
   */
  registerTrigger(request: RegisterTriggerRequest): RegisterTriggerRequest {
    // Validate request
    if (!request.id || !request.name || !request.type) {
      throw new Error('Trigger ID, name, and type are required')
    }

    // Check if already registered
    if (this.triggerRegistry.has(request.id)) {
      throw new Error(`Trigger with ID "${request.id}" is already registered`)
    }

    this.triggerRegistry.set(request.id, request)
    return request
  }

  /**
   * Get action registry entry
   */
  getAction(actionId: string): ActionRegistry | null {
    return this.actionRegistry.get(actionId) || null
  }

  /**
   * Get trigger registry entry
   */
  getTrigger(triggerId: string): RegisterTriggerRequest | null {
    return this.triggerRegistry.get(triggerId) || null
  }

  /**
   * List all registered actions
   */
  listActions(filter?: { type?: ActionType; registeredBy?: string }): ActionRegistry[] {
    let actions = Array.from(this.actionRegistry.values())

    if (filter) {
      if (filter.type) {
        actions = actions.filter(a => a.type === filter.type)
      }
      if (filter.registeredBy) {
        actions = actions.filter(a => a.registeredBy === filter.registeredBy)
      }
    }

    return actions
  }

  /**
   * List all registered triggers
   */
  listTriggers(): RegisterTriggerRequest[] {
    return Array.from(this.triggerRegistry.values())
  }

  /**
   * Unregister an action
   */
  unregisterAction(actionId: string, requestedBy: string): boolean {
    const action = this.actionRegistry.get(actionId)
    if (!action) {
      return false
    }

    // Only the registrant can unregister
    if (action.registeredBy !== requestedBy) {
      throw new Error('You do not have permission to unregister this action')
    }

    this.actionRegistry.delete(actionId)
    return true
  }

  /**
   * Unregister a trigger
   */
  unregisterTrigger(triggerId: string, requestedBy: string): boolean {
    const trigger = this.triggerRegistry.get(triggerId)
    if (!trigger) {
      return false
    }

    // Only the registrant can unregister
    if (trigger.registeredBy !== requestedBy) {
      throw new Error('You do not have permission to unregister this trigger')
    }

    this.triggerRegistry.delete(triggerId)
    return true
  }

  /**
   * Validate action registration request
   */
  private validateActionRequest(request: RegisterActionRequest): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!request.id || request.id.trim().length === 0) {
      errors.push('Action ID is required')
    } else if (!/^[a-z0-9_-]+$/.test(request.id)) {
      errors.push('Action ID must contain only lowercase letters, numbers, hyphens, and underscores')
    }

    if (!request.name || request.name.trim().length === 0) {
      errors.push('Action name is required')
    }

    if (!request.description || request.description.trim().length === 0) {
      warnings.push('Action description is recommended')
    }

    if (!request.type) {
      errors.push('Action type is required')
    }

    if (!request.parameters || !Array.isArray(request.parameters)) {
      errors.push('Parameters array is required')
    } else {
      request.parameters.forEach((param, index) => {
        if (!param.name) {
          errors.push(`Parameter ${index + 1}: name is required`)
        }
        if (!param.type) {
          errors.push(`Parameter ${index + 1}: type is required`)
        }
      })
    }

    if (!request.registeredBy) {
      errors.push('Registered by is required')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate code signature
   * In a real implementation, this would verify cryptographic signatures
   */
  private validateCodeSignature(signature: string): ValidationResult {
    const errors: string[] = []

    if (!signature || signature.trim().length === 0) {
      errors.push('Code signature cannot be empty')
    }

    // Basic format validation (in production, use proper signature verification)
    if (signature.length < 32) {
      errors.push('Code signature appears to be invalid (too short)')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    }
  }

  /**
   * Get documentation for an action
   */
  getActionDocumentation(actionId: string): string | null {
    const action = this.actionRegistry.get(actionId)
    if (!action) {
      return null
    }

    const doc: string[] = []
    doc.push(`# ${action.name}`)
    doc.push('')
    doc.push(action.description)
    doc.push('')
    doc.push(`**Type:** ${action.type}`)
    doc.push(`**ID:** ${action.id}`)
    doc.push('')

    if (action.parameters.length > 0) {
      doc.push('## Parameters')
      doc.push('')
      action.parameters.forEach(param => {
        doc.push(`### ${param.name}`)
        doc.push(`- **Type:** ${param.type}`)
        doc.push(`- **Required:** ${param.required ? 'Yes' : 'No'}`)
        if (param.description) {
          doc.push(`- **Description:** ${param.description}`)
        }
        if (param.defaultValue !== undefined) {
          doc.push(`- **Default:** ${JSON.stringify(param.defaultValue)}`)
        }
        doc.push('')
      })
    }

    return doc.join('\n')
  }
}

// Singleton instance
export const developerExtensionAPI = new DeveloperExtensionAPI()

// Example usage documentation
export const EXAMPLE_ACTION_REGISTRATION = `
// Example: Register a custom action
const action = developerExtensionAPI.registerAction({
  id: 'send_slack_notification',
  name: 'Send Slack Notification',
  description: 'Send a notification to a Slack channel',
  type: 'notification',
  parameters: [
    {
      name: 'channel',
      type: 'string',
      required: true,
      description: 'Slack channel name or ID',
    },
    {
      name: 'message',
      type: 'string',
      required: true,
      description: 'Message to send',
    },
    {
      name: 'webhookUrl',
      type: 'string',
      required: true,
      description: 'Slack webhook URL',
    },
  ],
  registeredBy: 'developer-id',
});

// Example: Register a custom trigger
const trigger = developerExtensionAPI.registerTrigger({
  id: 'slack_message_received',
  name: 'Slack Message Received',
  description: 'Triggered when a message is received in a Slack channel',
  type: 'webhook',
  configurationSchema: {
    channel: { type: 'string', required: true },
    webhookUrl: { type: 'string', required: true },
  },
  registeredBy: 'developer-id',
});
`
