/**
 * Workflow API Routes
 *
 * Provides endpoints for workflow management:
 * - Create, read, update, delete workflows
 * - Execute workflows
 * - Monitor executions
 * - Import/export workflows
 * - Version control
 * - Collaboration
 */

import { Router, Request, Response } from 'express'
import type { WorkflowDefinition, WorkflowExecution } from '../../../apps/web/src/types/workflow'
import { workflowImportExport } from '../../../../services/workflow/api/workflowImportExport'
import { workflowVersionControl } from '../../../../services/workflow/versioning/versionControl'
import { workflowCollaborationPermissions } from '../../../../services/workflow/security/collaborationPermissions'
import { developerExtensionAPI } from '../../../../services/workflow/api/developerExtensionAPI'

const router = Router()

// In-memory storage for demo (in production, use database)
const workflows: Map<string, WorkflowDefinition> = new Map()
const executions: Map<string, WorkflowExecution> = new Map()

/**
 * GET /api/demo/workflows
 * List all workflows
 */
router.get('/workflows', async (req: Request, res: Response) => {
  try {
    const workflowList = Array.from(workflows.values())
    res.json({ workflows: workflowList })
  } catch (error: any) {
    console.error('[workflows] Error listing workflows:', error)
    res.status(500).json({ error: 'Failed to list workflows', message: error.message })
  }
})

/**
 * GET /api/demo/workflows/:id
 * Get a specific workflow
 */
router.get('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const workflow = workflows.get(id)
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }
    res.json({ workflow })
  } catch (error: any) {
    console.error('[workflows] Error getting workflow:', error)
    res.status(500).json({ error: 'Failed to get workflow', message: error.message })
  }
})

/**
 * POST /api/demo/workflows
 * Create a new workflow
 */
router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const definition: WorkflowDefinition = req.body

    // Validate workflow
    const validation = workflowImportExport.validate(definition)
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors,
      })
    }

    // Initialize collaboration permissions
    workflowCollaborationPermissions.initializeWorkflow(
      definition.id,
      definition.createdBy,
      `${definition.createdBy}@example.com`
    )

    // Save workflow
    workflows.set(definition.id, definition)

    // Save version
    workflowVersionControl.saveVersion(
      definition.id,
      definition,
      definition.createdBy,
      'Initial version'
    )

    res.status(201).json({ workflow: definition })
  } catch (error: any) {
    console.error('[workflows] Error creating workflow:', error)
    res.status(500).json({ error: 'Failed to create workflow', message: error.message })
  }
})

/**
 * PUT /api/demo/workflows/:id
 * Update a workflow
 */
router.put('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const existing = workflows.get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    const updates: Partial<WorkflowDefinition> = req.body
    const updated: WorkflowDefinition = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    }

    // Validate
    const validation = workflowImportExport.validate(updated)
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors,
      })
    }

    workflows.set(id, updated)

    // Save new version
    workflowVersionControl.saveVersion(
      id,
      updated,
      updated.createdBy,
      updates.name ? `Updated: ${updates.name}` : 'Workflow updated'
    )

    res.json({ workflow: updated })
  } catch (error: any) {
    console.error('[workflows] Error updating workflow:', error)
    res.status(500).json({ error: 'Failed to update workflow', message: error.message })
  }
})

/**
 * DELETE /api/demo/workflows/:id
 * Delete a workflow
 */
router.delete('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const workflow = workflows.get(id)
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    workflows.delete(id)
    res.json({ success: true, message: 'Workflow deleted' })
  } catch (error: any) {
    console.error('[workflows] Error deleting workflow:', error)
    res.status(500).json({ error: 'Failed to delete workflow', message: error.message })
  }
})

/**
 * POST /api/demo/workflows/:id/execute
 * Execute a workflow
 */
router.post('/workflows/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const workflow = workflows.get(id)
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    // Create execution
    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflowId: id,
      workflowVersion: workflow.version,
      status: 'running',
      startedAt: new Date().toISOString(),
      triggeredBy: req.body.userId || 'system',
      triggerType: workflow.trigger.type,
      stepExecutions: workflow.steps.map((step) => ({
        id: `step-exec-${Date.now()}-${step.id}`,
        stepId: step.id,
        stepName: step.name,
        status: 'pending',
        startedAt: new Date().toISOString(),
      })),
    }

    executions.set(execution.id, execution)

    // In a real implementation, this would trigger the workflow engine
    // For demo purposes, we'll simulate execution
    setTimeout(() => {
      execution.status = 'completed'
      execution.completedAt = new Date().toISOString()
      execution.stepExecutions.forEach((step) => {
        step.status = 'completed'
        step.completedAt = new Date().toISOString()
        step.duration = 1000
      })
      executions.set(execution.id, execution)
    }, 2000)

    res.status(202).json({ execution })
  } catch (error: any) {
    console.error('[workflows] Error executing workflow:', error)
    res.status(500).json({ error: 'Failed to execute workflow', message: error.message })
  }
})

/**
 * GET /api/demo/workflows/executions
 * List workflow executions
 */
router.get('/workflows/executions', async (req: Request, res: Response) => {
  try {
    const { workflowId, status } = req.query
    let executionList = Array.from(executions.values())

    if (workflowId) {
      executionList = executionList.filter((e) => e.workflowId === workflowId)
    }
    if (status) {
      executionList = executionList.filter((e) => e.status === status)
    }

    res.json({ executions: executionList })
  } catch (error: any) {
    console.error('[workflows] Error listing executions:', error)
    res.status(500).json({ error: 'Failed to list executions', message: error.message })
  }
})

/**
 * GET /api/demo/workflows/:id/versions
 * Get workflow versions
 */
router.get('/workflows/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const versions = workflowVersionControl.getVersions(id)
    res.json({ versions })
  } catch (error: any) {
    console.error('[workflows] Error getting versions:', error)
    res.status(500).json({ error: 'Failed to get versions', message: error.message })
  }
})

/**
 * POST /api/demo/workflows/:id/export
 * Export workflow
 */
router.post('/workflows/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { format = 'json' } = req.body
    const workflow = workflows.get(id)
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    if (format === 'json') {
      const json = workflowImportExport.exportAsJSON(workflow, { format: 'json', includeMetadata: true })
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${workflow.name}.json"`)
      res.send(json)
    } else if (format === 'dsl') {
      const dsl = workflowImportExport.exportAsDSL(workflow)
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Disposition', `attachment; filename="${workflow.name}.dsl"`)
      res.send(dsl)
    } else {
      return res.status(400).json({ error: 'Invalid format. Use "json" or "dsl"' })
    }
  } catch (error: any) {
    console.error('[workflows] Error exporting workflow:', error)
    res.status(500).json({ error: 'Failed to export workflow', message: error.message })
  }
})

/**
 * POST /api/demo/workflows/import
 * Import workflow
 */
router.post('/workflows/import', async (req: Request, res: Response) => {
  try {
    const { format = 'json', data } = req.body
    if (!data) {
      return res.status(400).json({ error: 'Data is required' })
    }

    let result
    if (format === 'json') {
      result = workflowImportExport.importFromJSON(data)
    } else if (format === 'dsl') {
      result = workflowImportExport.importFromDSL(data)
    } else {
      return res.status(400).json({ error: 'Invalid format. Use "json" or "dsl"' })
    }

    if (!result.success) {
      return res.status(400).json(result)
    }

    if (result.workflow) {
      workflows.set(result.workflow.id, result.workflow)
      workflowVersionControl.saveVersion(
        result.workflow.id,
        result.workflow,
        result.workflow.createdBy,
        'Imported workflow'
      )
    }

    res.json(result)
  } catch (error: any) {
    console.error('[workflows] Error importing workflow:', error)
    res.status(500).json({ error: 'Failed to import workflow', message: error.message })
  }
})

/**
 * GET /api/demo/workflows/:id/collaborators
 * Get workflow collaborators
 */
router.get('/workflows/:id/collaborators', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const collaborators = workflowCollaborationPermissions.getCollaborators(id)
    res.json({ collaborators })
  } catch (error: any) {
    console.error('[workflows] Error getting collaborators:', error)
    res.status(500).json({ error: 'Failed to get collaborators', message: error.message })
  }
})

/**
 * POST /api/demo/workflows/:id/collaborators
 * Invite collaborator
 */
router.post('/workflows/:id/collaborators', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { email, role, invitedBy } = req.body

    if (!email || !role || !invitedBy) {
      return res.status(400).json({ error: 'Email, role, and invitedBy are required' })
    }

    const collaborator = workflowCollaborationPermissions.inviteCollaborator({
      workflowId: id,
      email,
      role,
      invitedBy,
    })

    res.status(201).json({ collaborator })
  } catch (error: any) {
    console.error('[workflows] Error inviting collaborator:', error)
    res.status(400).json({ error: error.message })
  }
})

/**
 * GET /api/demo/workflows/actions
 * List registered actions
 */
router.get('/workflows/actions', async (req: Request, res: Response) => {
  try {
    const { type, registeredBy } = req.query
    const actions = developerExtensionAPI.listActions({
      type: type as any,
      registeredBy: registeredBy as string,
    })
    res.json({ actions })
  } catch (error: any) {
    console.error('[workflows] Error listing actions:', error)
    res.status(500).json({ error: 'Failed to list actions', message: error.message })
  }
})

/**
 * POST /api/demo/workflows/actions/register
 * Register a new action
 */
router.post('/workflows/actions/register', async (req: Request, res: Response) => {
  try {
    const action = developerExtensionAPI.registerAction(req.body)
    res.status(201).json({ action })
  } catch (error: any) {
    console.error('[workflows] Error registering action:', error)
    res.status(400).json({ error: error.message })
  }
})

export default router

