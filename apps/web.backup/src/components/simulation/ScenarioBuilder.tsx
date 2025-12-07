'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  GripVertical,
  Plus,
  Trash2,
  Save,
  Play,
  X,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Scenario } from '@/app/demo/org/simulation/page'

type DomainModule = {
  id: string
  name: string
  type: 'task' | 'event' | 'flow'
  description?: string
}

type ScenarioEvent = {
  id: string
  type: string
  timestamp: number
  module: string
  data?: Record<string, unknown>
}

type Expectation = {
  id: string
  metric: string
  operator: 'gt' | 'lt' | 'eq'
  value: number
}

const AVAILABLE_MODULES: DomainModule[] = [
  { id: 'auth', name: 'Authentication', type: 'task', description: 'User authentication and authorization' },
  { id: 'credential', name: 'Credential Management', type: 'task', description: 'Credential issuance and verification' },
  { id: 'enrollment', name: 'Enrollment', type: 'flow', description: 'Clinician enrollment workflow' },
  { id: 'privilege', name: 'Privilege Management', type: 'task', description: 'Privilege assignment and renewal' },
  { id: 'compliance', name: 'Compliance', type: 'event', description: 'Compliance monitoring events' },
  { id: 'audit', name: 'Audit Logging', type: 'event', description: 'Audit trail generation' },
  { id: 'notification', name: 'Notifications', type: 'event', description: 'System notifications' },
  { id: 'workflow', name: 'Workflow Engine', type: 'flow', description: 'Business process workflows' },
]

const EVENT_TYPES = [
  'user_login',
  'credential_issued',
  'credential_verified',
  'privilege_granted',
  'compliance_check',
  'audit_event',
  'notification_sent',
  'workflow_started',
  'workflow_completed',
]

interface ScenarioBuilderProps {
  onScenarioSelect: (scenario: Scenario) => void
  onScenarioCreate: (scenario: Scenario) => void
  selectedScenario: Scenario | null
}

export function ScenarioBuilder({
  onScenarioSelect,
  onScenarioCreate,
  selectedScenario,
}: ScenarioBuilderProps) {
  const [scenarioName, setScenarioName] = useState('')
  const [scenarioDescription, setScenarioDescription] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [events, setEvents] = useState<ScenarioEvent[]>([])
  const [expectations, setExpectations] = useState<Expectation[]>([])
  const [draggedModule, setDraggedModule] = useState<string | null>(null)
  const [draggedEvent, setDraggedEvent] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const availableModules = AVAILABLE_MODULES.filter((m) => !selectedModules.includes(m.id))

  const handleDragStart = (moduleId: string, e: React.DragEvent) => {
    setDraggedModule(moduleId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedModule) {
      setSelectedModules([...selectedModules, draggedModule])
      setDraggedModule(null)
    }
  }

  const handleEventDragStart = (eventId: string, e: React.DragEvent) => {
    setDraggedEvent(eventId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleEventDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault()
    if (draggedEvent) {
      const draggedIndex = events.findIndex((e) => e.id === draggedEvent)
      if (draggedIndex !== -1) {
        const newEvents = [...events]
        const [removed] = newEvents.splice(draggedIndex, 1)
        newEvents.splice(targetIndex, 0, removed)
        setEvents(newEvents)
      }
      setDraggedEvent(null)
    }
  }

  const handleAddModule = (moduleId: string) => {
    if (!selectedModules.includes(moduleId)) {
      setSelectedModules([...selectedModules, moduleId])
    }
  }

  const handleRemoveModule = (moduleId: string) => {
    setSelectedModules(selectedModules.filter((id) => id !== moduleId))
    // Remove events associated with this module
    setEvents(events.filter((e) => e.module !== moduleId))
  }

  const handleAddEvent = () => {
    if (selectedModules.length === 0) return

    const newEvent: ScenarioEvent = {
      id: `event-${Date.now()}`,
      type: EVENT_TYPES[0],
      timestamp: events.length * 1000,
      module: selectedModules[0],
    }
    setEvents([...events, newEvent])
  }

  const handleUpdateEvent = (eventId: string, updates: Partial<ScenarioEvent>) => {
    setEvents(events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)))
  }

  const handleRemoveEvent = (eventId: string) => {
    setEvents(events.filter((e) => e.id !== eventId))
  }

  const handleAddExpectation = () => {
    const newExpectation: Expectation = {
      id: `expectation-${Date.now()}`,
      metric: 'success_rate',
      operator: 'gt',
      value: 95,
    }
    setExpectations([...expectations, newExpectation])
  }

  const handleUpdateExpectation = (expectationId: string, updates: Partial<Expectation>) => {
    setExpectations(expectations.map((e) => (e.id === expectationId ? { ...e, ...updates } : e)))
  }

  const handleRemoveExpectation = (expectationId: string) => {
    setExpectations(expectations.filter((e) => e.id !== expectationId))
  }

  const handleSaveScenario = () => {
    if (!scenarioName.trim()) return

    const scenario: Scenario = {
      id: `scenario-${Date.now()}`,
      name: scenarioName,
      description: scenarioDescription || undefined,
      modules: selectedModules,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        module: e.module,
      })),
      expectations: expectations.length > 0 ? expectations : undefined,
    }

    onScenarioCreate(scenario)
    onScenarioSelect(scenario)
    setIsCreating(false)
    // Reset form
    setScenarioName('')
    setScenarioDescription('')
    setSelectedModules([])
    setEvents([])
    setExpectations([])
  }

  const handleSelectPreset = (scenario: Scenario) => {
    onScenarioSelect(scenario)
    setIsCreating(false)
  }

  return (
    <div className="space-y-6">
      {/* Preset Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Preset Scenarios</CardTitle>
          <CardDescription>Select a pre-configured scenario or create a custom one</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                const scenario: Scenario = {
                  id: 'preset-auth-flow',
                  name: 'Authentication Flow',
                  description: 'Test authentication and credential verification',
                  modules: ['auth', 'credential'],
                  events: [
                    { id: 'e1', type: 'user_login', timestamp: 0, module: 'auth' },
                    { id: 'e2', type: 'credential_verified', timestamp: 1000, module: 'credential' },
                  ],
                }
                handleSelectPreset(scenario)
              }}
            >
              <div className="font-semibold">Authentication Flow</div>
              <div className="text-xs text-muted-foreground mt-1">Auth + Credential modules</div>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                const scenario: Scenario = {
                  id: 'preset-enrollment',
                  name: 'Enrollment Workflow',
                  description: 'Complete enrollment process',
                  modules: ['enrollment', 'credential', 'privilege'],
                  events: [
                    { id: 'e1', type: 'workflow_started', timestamp: 0, module: 'enrollment' },
                    { id: 'e2', type: 'credential_issued', timestamp: 2000, module: 'credential' },
                    { id: 'e3', type: 'privilege_granted', timestamp: 3000, module: 'privilege' },
                    { id: 'e4', type: 'workflow_completed', timestamp: 4000, module: 'enrollment' },
                  ],
                }
                handleSelectPreset(scenario)
              }}
            >
              <div className="font-semibold">Enrollment Workflow</div>
              <div className="text-xs text-muted-foreground mt-1">Full enrollment process</div>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                setIsCreating(true)
              }}
            >
              <div className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Custom Scenario
              </div>
              <div className="text-xs text-muted-foreground mt-1">Build your own scenario</div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selected Scenario Display */}
      {selectedScenario && !isCreating && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedScenario.name}
                  <Badge variant="outline">Selected</Badge>
                </CardTitle>
                {selectedScenario.description && (
                  <CardDescription>{selectedScenario.description}</CardDescription>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Modules ({selectedScenario.modules.length})</p>
                <div className="flex flex-wrap gap-2">
                  {selectedScenario.modules.map((moduleId) => {
                    const module = AVAILABLE_MODULES.find((m) => m.id === moduleId)
                    return module ? (
                      <Badge key={moduleId} variant="outline">
                        {module.name}
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Events ({selectedScenario.events.length})</p>
                <div className="text-sm text-muted-foreground">
                  {selectedScenario.events.length} events configured
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenario Builder */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Build Custom Scenario</CardTitle>
            <CardDescription>Drag-and-drop modules and configure events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scenario Metadata */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="scenario-name">Scenario Name</Label>
                <Input
                  id="scenario-name"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g., Multi-module Integration Test"
                />
              </div>
              <div>
                <Label htmlFor="scenario-description">Description (Optional)</Label>
                <Input
                  id="scenario-description"
                  value={scenarioDescription}
                  onChange={(e) => setScenarioDescription(e.target.value)}
                  placeholder="Describe what this scenario tests"
                />
              </div>
            </div>

            {/* Module Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Available Modules</Label>
                <div className="mt-2 space-y-2">
                  {availableModules.map((module) => (
                    <div
                      key={module.id}
                      draggable
                      onDragStart={(e) => handleDragStart(module.id, e)}
                      className={cn(
                        'p-3 border rounded-lg cursor-move hover:bg-accent transition-colors',
                        draggedModule === module.id && 'opacity-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{module.name}</div>
                          {module.description && (
                            <div className="text-xs text-muted-foreground">{module.description}</div>
                          )}
                        </div>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {module.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Selected Modules</Label>
                <div
                  className="mt-2 min-h-[200px] border-2 border-dashed rounded-lg p-4"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {selectedModules.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Drag modules here or click to add
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedModules.map((moduleId) => {
                        const module = AVAILABLE_MODULES.find((m) => m.id === moduleId)
                        return module ? (
                          <div
                            key={moduleId}
                            className="p-3 border rounded-lg bg-background flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-sm">{module.name}</div>
                              <Badge variant="outline" className="mt-1 text-xs">
                                {module.type}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveModule(moduleId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableModules.map((module) => (
                    <Button
                      key={module.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddModule(module.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {module.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Events Configuration */}
            {selectedModules.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Events</Label>
                  <Button variant="outline" size="sm" onClick={handleAddEvent}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </div>
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div
                      key={event.id}
                      draggable
                      onDragStart={(e) => handleEventDragStart(event.id, e)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleEventDrop(index, e)}
                      className={cn(
                        'p-4 border rounded-lg bg-background flex items-center gap-4',
                        draggedEvent === event.id && 'opacity-50'
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={event.type}
                            onValueChange={(value) => handleUpdateEvent(event.id, { type: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EVENT_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Module</Label>
                          <Select
                            value={event.module}
                            onValueChange={(value) => handleUpdateEvent(event.id, { module: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedModules.map((moduleId) => {
                                const module = AVAILABLE_MODULES.find((m) => m.id === moduleId)
                                return (
                                  <SelectItem key={moduleId} value={moduleId}>
                                    {module?.name || moduleId}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Timestamp (ms)</Label>
                          <Input
                            type="number"
                            value={event.timestamp}
                            onChange={(e) =>
                              handleUpdateEvent(event.id, { timestamp: parseInt(e.target.value) || 0 })
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEvent(event.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                      No events configured. Add events to define the scenario timeline.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Expectations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label>Expectations (Optional)</Label>
                <Button variant="outline" size="sm" onClick={handleAddExpectation}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expectation
                </Button>
              </div>
              <div className="space-y-2">
                {expectations.map((expectation) => (
                  <div key={expectation.id} className="p-4 border rounded-lg bg-background flex items-center gap-4">
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs">Metric</Label>
                        <Input
                          value={expectation.metric}
                          onChange={(e) =>
                            handleUpdateExpectation(expectation.id, { metric: e.target.value })
                          }
                          className="h-8"
                          placeholder="success_rate"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Operator</Label>
                        <Select
                          value={expectation.operator}
                          onValueChange={(value: 'gt' | 'lt' | 'eq') =>
                            handleUpdateExpectation(expectation.id, { operator: value })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gt">&gt; (Greater Than)</SelectItem>
                            <SelectItem value="lt">&lt; (Less Than)</SelectItem>
                            <SelectItem value="eq">= (Equal To)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Value</Label>
                        <Input
                          type="number"
                          value={expectation.value}
                          onChange={(e) =>
                            handleUpdateExpectation(expectation.id, {
                              value: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveExpectation(expectation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveScenario} disabled={!scenarioName.trim() || selectedModules.length === 0}>
                <Save className="h-4 w-4 mr-2" />
                Save Scenario
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

