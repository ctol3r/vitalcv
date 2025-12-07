// Workflow Types and Interfaces

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived'
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
export type TriggerType = 'event' | 'cron' | 'webhook' | 'manual'
export type ActionType = 'notification' | 'api_call' | 'data_transform' | 'condition' | 'delay' | 'custom'

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  status: WorkflowStatus
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
  organizationId?: string
  trigger: TriggerConfig
  steps: WorkflowStep[]
  metadata?: Record<string, any>
}

export interface TriggerConfig {
  type: TriggerType
  eventTypes?: string[]
  cronExpression?: string
  webhookUrl?: string
  webhookSecret?: string
  nextRunTime?: string
}

export interface WorkflowStep {
  id: string
  name: string
  type: ActionType
  action: string // Action identifier
  parameters: Record<string, any>
  conditions?: StepCondition[]
  onSuccess?: string[] // IDs of next steps
  onFailure?: string[] // IDs of next steps
  position: { x: number; y: number }
  metadata?: Record<string, any>
}

export interface StepCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists'
  value: any
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  workflowVersion: number
  status: StepStatus
  startedAt: string
  completedAt?: string
  triggeredBy: string
  triggerType: TriggerType
  stepExecutions: StepExecution[]
  error?: string
  metadata?: Record<string, any>
}

export interface StepExecution {
  id: string
  stepId: string
  stepName: string
  status: StepStatus
  startedAt: string
  completedAt?: string
  duration?: number
  input?: Record<string, any>
  output?: Record<string, any>
  error?: string
  logs?: string[]
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  definition: WorkflowDefinition
  preview?: string
  tags?: string[]
}

export interface WorkflowVersion {
  id: string
  workflowId: string
  version: number
  definition: WorkflowDefinition
  createdAt: string
  createdBy: string
  changeDescription?: string
}

export interface WorkflowCollaborator {
  id: string
  workflowId: string
  userId: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
  invitedAt: string
  invitedBy: string
}

export interface ActionRegistry {
  id: string
  name: string
  description: string
  type: ActionType
  parameters: ActionParameter[]
  codeSignature?: string
  registeredBy: string
  registeredAt: string
}

export interface ActionParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description?: string
  defaultValue?: any
  validation?: {
    pattern?: string
    min?: number
    max?: number
    enum?: any[]
  }
}

