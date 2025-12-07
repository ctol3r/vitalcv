'use client'

import { useState, useCallback, useMemo } from 'react'
import { Save, Plus, Trash2, Undo2, Redo2, Play, Settings, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WorkflowStepEditor } from '@/components/workflows/StepEditor'
import { TriggerConfiguration } from '@/components/workflows/TriggerConfig'
import type { WorkflowDefinition, WorkflowStep, TriggerConfig } from '@/types/workflow'

interface HistoryState {
  definition: WorkflowDefinition
  timestamp: number
}

export default function VisualWorkflowBuilderPage() {
  const [workflowName, setWorkflowName] = useState('')
  const [workflowDescription, setWorkflowDescription] = useState('')
  const [trigger, setTrigger] = useState<TriggerConfig>({
    type: 'manual',
  })
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [saving, setSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const saveToHistory = useCallback((definition: WorkflowDefinition) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      definition: JSON.parse(JSON.stringify(definition)),
      timestamp: Date.now(),
    })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      const def = prevState.definition
      setWorkflowName(def.name)
      setWorkflowDescription(def.description || '')
      setTrigger(def.trigger)
      setSteps(def.steps)
      setHistoryIndex(historyIndex - 1)
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      const def = nextState.definition
      setWorkflowName(def.name)
      setWorkflowDescription(def.description || '')
      setTrigger(def.trigger)
      setSteps(def.steps)
      setHistoryIndex(historyIndex + 1)
    }
  }, [history, historyIndex])

  const validateWorkflow = (): boolean => {
    const errors: string[] = []
    if (!workflowName.trim()) errors.push('Workflow name is required')
    if (!trigger.type) errors.push('Trigger configuration is required')
    if (trigger.type === 'event' && (!trigger.eventTypes || trigger.eventTypes.length === 0)) {
      errors.push('At least one event type is required for event triggers')
    }
    if (trigger.type === 'cron' && !trigger.cronExpression) {
      errors.push('Cron expression is required for cron triggers')
    }
    if (trigger.type === 'webhook' && !trigger.webhookUrl) {
      errors.push('Webhook URL is required for webhook triggers')
    }
    if (steps.length === 0) errors.push('At least one step is required')
    steps.forEach((step, index) => {
      if (!step.name) errors.push(`Step ${index + 1}: Name is required`)
      if (!step.action) errors.push(`Step ${index + 1}: Action is required`)
    })
    setValidationErrors(errors)
    return errors.length === 0
  }

  const handleAddStep = () => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      type: 'notification',
      action: '',
      parameters: {},
      position: { x: steps.length * 200, y: 100 },
    }
    setSteps([...steps, newStep])
    setEditingStep(newStep)
  }

  const handleStepSave = (step: WorkflowStep) => {
    const index = steps.findIndex((s) => s.id === step.id)
    if (index >= 0) {
      const updated = [...steps]
      updated[index] = step
      setSteps(updated)
    } else {
      setSteps([...steps, step])
    }
    setEditingStep(null)
    setSelectedStep(null)
  }

  const handleStepDelete = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId))
    if (selectedStep?.id === stepId) {
      setSelectedStep(null)
    }
    if (editingStep?.id === stepId) {
      setEditingStep(null)
    }
  }

  const handleSave = async () => {
    if (!validateWorkflow()) return

    setSaving(true)
    try {
      const definition: WorkflowDefinition = {
        id: `wf-${Date.now()}`,
        name: workflowName.trim(),
        description: workflowDescription.trim() || undefined,
        status: 'draft',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user', // TODO: Get from auth context
        trigger,
        steps,
      }

      saveToHistory(definition)

      const response = await fetch('/api/demo/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(definition),
      })

      if (!response.ok) {
        throw new Error('Failed to save workflow')
      }

      // Show success message
      alert('Workflow saved successfully!')
    } catch (error: any) {
      alert(`Failed to save workflow: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Demo &raquo; Workflows &raquo; Builder</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workflow Builder</h1>
            <p className="text-muted-foreground max-w-2xl">
              Create and configure workflows with a visual drag-and-drop interface. Add triggers, steps, and actions to
              automate your processes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4 mr-2" />
              Redo
            </Button>
            <Button variant="outline" size="sm">
              <Play className="h-4 w-4 mr-2" />
              Test
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Workflow'}
            </Button>
          </div>
        </div>
      </header>

      {validationErrors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Validation Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, i) => (
                <li key={i} className="text-sm">{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Details</CardTitle>
              <CardDescription>Basic information about your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workflow-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="workflow-name"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="My Workflow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workflow-description">Description</Label>
                <Textarea
                  id="workflow-description"
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <TriggerConfiguration trigger={trigger} onChange={setTrigger} />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Workflow Steps</CardTitle>
                  <CardDescription>Add and configure steps for your workflow</CardDescription>
                </div>
                <Button onClick={handleAddStep} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="mb-4">No steps added yet.</p>
                  <Button onClick={handleAddStep} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Step
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <Card
                      key={step.id}
                      className={`cursor-pointer transition-colors ${
                        selectedStep?.id === step.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedStep(step)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">Step {index + 1}</Badge>
                              <span className="font-semibold">{step.name}</span>
                              <Badge variant="secondary">{step.type}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Action: <code className="text-xs bg-muted px-1 py-0.5 rounded">{step.action || 'Not set'}</code>
                            </p>
                            {step.conditions && step.conditions.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {step.conditions.length} condition{step.conditions.length !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingStep(step)
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStepDelete(step.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline">Draft</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Steps</span>
                <span className="font-semibold">{steps.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trigger</span>
                <Badge variant="secondary">{trigger.type}</Badge>
              </div>
              {validateWorkflow() && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm pt-2 border-t">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Workflow is valid</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Import Template
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                Export Workflow
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                View History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {editingStep && (
        <Dialog open={!!editingStep} onOpenChange={(open) => !open && setEditingStep(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Step: {editingStep.name}</DialogTitle>
              <DialogDescription>Configure the action, parameters, and conditions for this step</DialogDescription>
            </DialogHeader>
            <WorkflowStepEditor
              step={editingStep}
              onSave={handleStepSave}
              onCancel={() => setEditingStep(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
