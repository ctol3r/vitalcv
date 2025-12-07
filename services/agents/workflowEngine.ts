/**
 * Multi-agent Workflow Engine - B140B-AGENT-019
 *
 * Supports multi-step workflow patterns:
 * - Plan: Define objectives and strategy
 * - Propose: Generate solutions or approaches
 * - Implement: Execute tasks
 * - Review: Validate and verify results
 *
 * Integrates with Copilot, OpenCode, and OpenAI agents
 */

import { z } from 'zod';
import { router, type TaskSpec } from './router';
import { registry, AgentScope, RiskTier } from './registry';

// ============================================================
// ENUMS & TYPES
// ============================================================

export enum WorkflowStep {
  PLAN = 'plan',
  PROPOSE = 'propose',
  IMPLEMENT = 'implement',
  REVIEW = 'review',
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ============================================================
// SCHEMAS
// ============================================================

export const WorkflowStepConfigSchema = z.object({
  step: z.nativeEnum(WorkflowStep),
  name: z.string(),
  description: z.string().optional(),
  requiredCapabilities: z.array(z.string()),
  requiredScopes: z.array(z.nativeEnum(AgentScope)),
  riskLevel: z.nativeEnum(RiskTier),
  timeout: z.number().optional(), // milliseconds
  retries: z.number().default(0),
  optional: z.boolean().default(false),
  dependsOn: z.array(z.nativeEnum(WorkflowStep)).default([]),
});

export type WorkflowStepConfig = z.infer<typeof WorkflowStepConfigSchema>;

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(WorkflowStepConfigSchema),
  maxDuration: z.number().optional(), // milliseconds
  metadata: z.record(z.any()).optional(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export const WorkflowStepResultSchema = z.object({
  step: z.nativeEnum(WorkflowStep),
  agentId: z.string(),
  status: z.nativeEnum(WorkflowStatus),
  result: z.any().optional(),
  error: z.string().optional(),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().optional(), // milliseconds
  retryCount: z.number().default(0),
});

export type WorkflowStepResult = z.infer<typeof WorkflowStepResultSchema>;

export const WorkflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  status: z.nativeEnum(WorkflowStatus),
  currentStep: z.nativeEnum(WorkflowStep).optional(),
  stepResults: z.array(WorkflowStepResultSchema).default([]),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().optional(), // milliseconds
  metadata: z.record(z.any()).optional(),
});

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

// ============================================================
// WORKFLOW ENGINE CLASS
// ============================================================

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();

  private constructor() {
    this.initializeDefaultWorkflows();
  }

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
    const validated = WorkflowDefinitionSchema.parse(workflow);
    this.workflows.set(validated.id, validated);
    return validated;
  }

  /**
   * Get workflow definition
   */
  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    context: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = `${workflowId}-${Date.now()}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: WorkflowStatus.RUNNING,
      stepResults: [],
      startTime: new Date(),
      metadata: context,
    };

    this.executions.set(executionId, execution);

    try {
      // Execute steps in order
      for (const stepConfig of workflow.steps) {
        // Check dependencies
        if (!this.checkDependencies(stepConfig, execution)) {
          if (!stepConfig.optional) {
            throw new Error(`Dependencies not met for step ${stepConfig.step}`);
          }
          continue;
        }

        execution.currentStep = stepConfig.step;
        const stepResult = await this.executeStep(stepConfig, execution, context);
        execution.stepResults.push(stepResult);

        if (stepResult.status === WorkflowStatus.FAILED && !stepConfig.optional) {
          execution.status = WorkflowStatus.FAILED;
          break;
        }
      }

      if (execution.status === WorkflowStatus.RUNNING) {
        execution.status = WorkflowStatus.COMPLETED;
      }
    } catch (error) {
      execution.status = WorkflowStatus.FAILED;
      execution.metadata = {
        ...execution.metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      this.executions.set(executionId, execution);
    }

    return execution;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    stepConfig: WorkflowStepConfig,
    execution: WorkflowExecution,
    context: Record<string, any>
  ): Promise<WorkflowStepResult> {
    const startTime = new Date();
    let retryCount = 0;

    while (retryCount <= stepConfig.retries) {
      try {
        // Create task spec for routing
        const taskSpec: TaskSpec = {
          id: `${execution.id}-${stepConfig.step}`,
          name: stepConfig.name,
          description: stepConfig.description,
          requiredCapabilities: stepConfig.requiredCapabilities,
          requiredScopes: stepConfig.requiredScopes,
          riskLevel: stepConfig.riskLevel,
          priority: 'medium',
          metadata: context,
        };

        // Route to appropriate agent
        const routingResult = await router.route(taskSpec);

        if (!routingResult.selectedAgent) {
          throw new Error(`No agent available for step ${stepConfig.step}`);
        }

        // Execute step based on type
        const result = await this.executeStepLogic(
          stepConfig.step,
          routingResult.selectedAgent,
          context
        );

        const endTime = new Date();
        return {
          step: stepConfig.step,
          agentId: routingResult.selectedAgent,
          status: WorkflowStatus.COMPLETED,
          result,
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          retryCount,
        };
      } catch (error) {
        retryCount++;
        if (retryCount > stepConfig.retries) {
          const endTime = new Date();
          return {
            step: stepConfig.step,
            agentId: 'unknown',
            status: WorkflowStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
            startTime,
            endTime,
            duration: endTime.getTime() - startTime.getTime(),
            retryCount: retryCount - 1,
          };
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Should never reach here, but satisfy TypeScript
    throw new Error(`Failed to execute step ${stepConfig.step}`);
  }

  /**
   * Execute step-specific logic
   */
  private async executeStepLogic(
    step: WorkflowStep,
    agentId: string,
    context: Record<string, any>
  ): Promise<any> {
    const agent = registry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Simulate step execution based on type
    switch (step) {
      case WorkflowStep.PLAN:
        return {
          stepType: 'plan',
          agentName: agent.name,
          plan: `Plan generated by ${agent.name}`,
          objectives: context.objectives || [],
          strategy: 'Generated strategy based on objectives',
          timestamp: new Date(),
        };

      case WorkflowStep.PROPOSE:
        return {
          stepType: 'propose',
          agentName: agent.name,
          proposals: [
            { id: 'prop-1', description: 'Proposal 1', confidence: 0.85 },
            { id: 'prop-2', description: 'Proposal 2', confidence: 0.75 },
          ],
          recommendedProposal: 'prop-1',
          timestamp: new Date(),
        };

      case WorkflowStep.IMPLEMENT:
        return {
          stepType: 'implement',
          agentName: agent.name,
          implementation: 'Implementation completed',
          artifacts: ['artifact-1', 'artifact-2'],
          changes: ['change-1', 'change-2'],
          timestamp: new Date(),
        };

      case WorkflowStep.REVIEW:
        return {
          stepType: 'review',
          agentName: agent.name,
          approved: true,
          issues: [],
          recommendations: ['Recommendation 1', 'Recommendation 2'],
          timestamp: new Date(),
        };

      default:
        throw new Error(`Unknown step type: ${step}`);
    }
  }

  /**
   * Check if step dependencies are met
   */
  private checkDependencies(
    stepConfig: WorkflowStepConfig,
    execution: WorkflowExecution
  ): boolean {
    if (stepConfig.dependsOn.length === 0) {
      return true;
    }

    return stepConfig.dependsOn.every(dep => {
      const depResult = execution.stepResults.find(r => r.step === dep);
      return depResult && depResult.status === WorkflowStatus.COMPLETED;
    });
  }

  /**
   * Get workflow execution
   */
  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  /**
   * Get all executions for a workflow
   */
  getExecutionsByWorkflow(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(
      exec => exec.workflowId === workflowId
    );
  }

  /**
   * Cancel workflow execution
   */
  cancelExecution(id: string): boolean {
    const execution = this.executions.get(id);
    if (!execution || execution.status !== WorkflowStatus.RUNNING) {
      return false;
    }

    execution.status = WorkflowStatus.CANCELLED;
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    this.executions.set(id, execution);
    return true;
  }

  /**
   * Clear executions (for testing)
   */
  clearExecutions(): void {
    this.executions.clear();
  }

  /**
   * Initialize default workflows
   */
  private initializeDefaultWorkflows(): void {
    // FHIR Query Workflow
    this.registerWorkflow({
      id: 'fhir-query-workflow',
      name: 'FHIR Query Workflow',
      description: 'Plan and execute FHIR resource queries',
      steps: [
        {
          step: WorkflowStep.PLAN,
          name: 'Plan Query',
          description: 'Plan the FHIR query strategy',
          requiredCapabilities: ['fhir-query', 'planning'],
          requiredScopes: [AgentScope.READ],
          riskLevel: RiskTier.LOW,
          dependsOn: [],
        },
        {
          step: WorkflowStep.IMPLEMENT,
          name: 'Execute Query',
          description: 'Execute the FHIR query',
          requiredCapabilities: ['fhir-query'],
          requiredScopes: [AgentScope.READ, AgentScope.FHIR_QUERY],
          riskLevel: RiskTier.LOW,
          dependsOn: [WorkflowStep.PLAN],
        },
        {
          step: WorkflowStep.REVIEW,
          name: 'Review Results',
          description: 'Review query results',
          requiredCapabilities: ['analysis'],
          requiredScopes: [AgentScope.READ],
          riskLevel: RiskTier.LOW,
          optional: true,
          dependsOn: [WorkflowStep.IMPLEMENT],
        },
      ],
    });

    // Code Refactoring Workflow
    this.registerWorkflow({
      id: 'code-refactor-workflow',
      name: 'Code Refactoring Workflow',
      description: 'Plan, propose, implement, and review code refactoring',
      steps: [
        {
          step: WorkflowStep.PLAN,
          name: 'Plan Refactoring',
          description: 'Analyze code and plan refactoring strategy',
          requiredCapabilities: ['code-analysis'],
          requiredScopes: [AgentScope.REPO_READ],
          riskLevel: RiskTier.MEDIUM,
          dependsOn: [],
        },
        {
          step: WorkflowStep.PROPOSE,
          name: 'Propose Changes',
          description: 'Generate refactoring proposals',
          requiredCapabilities: ['refactoring'],
          requiredScopes: [AgentScope.REPO_READ],
          riskLevel: RiskTier.MEDIUM,
          dependsOn: [WorkflowStep.PLAN],
        },
        {
          step: WorkflowStep.IMPLEMENT,
          name: 'Implement Refactoring',
          description: 'Apply refactoring changes',
          requiredCapabilities: ['refactoring'],
          requiredScopes: [AgentScope.REPO_WRITE],
          riskLevel: RiskTier.HIGH,
          retries: 1,
          dependsOn: [WorkflowStep.PROPOSE],
        },
        {
          step: WorkflowStep.REVIEW,
          name: 'Review Changes',
          description: 'Review and validate refactoring',
          requiredCapabilities: ['code-analysis'],
          requiredScopes: [AgentScope.REPO_READ],
          riskLevel: RiskTier.MEDIUM,
          dependsOn: [WorkflowStep.IMPLEMENT],
        },
      ],
    });

    // Credential Verification Workflow
    this.registerWorkflow({
      id: 'credential-verification-workflow',
      name: 'Credential Verification Workflow',
      description: 'Plan and execute credential verification',
      steps: [
        {
          step: WorkflowStep.PLAN,
          name: 'Plan Verification',
          description: 'Plan credential verification strategy',
          requiredCapabilities: ['verification'],
          requiredScopes: [AgentScope.READ],
          riskLevel: RiskTier.MEDIUM,
          dependsOn: [],
        },
        {
          step: WorkflowStep.IMPLEMENT,
          name: 'Execute Verification',
          description: 'Execute PSV checks',
          requiredCapabilities: ['verification', 'psv-query'],
          requiredScopes: [AgentScope.PSV_QUERY],
          riskLevel: RiskTier.MEDIUM,
          retries: 2,
          dependsOn: [WorkflowStep.PLAN],
        },
        {
          step: WorkflowStep.REVIEW,
          name: 'Review Results',
          description: 'Review verification results',
          requiredCapabilities: ['analysis'],
          requiredScopes: [AgentScope.READ],
          riskLevel: RiskTier.MEDIUM,
          dependsOn: [WorkflowStep.IMPLEMENT],
        },
      ],
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const workflowEngine = WorkflowEngine.getInstance();
export default workflowEngine;

