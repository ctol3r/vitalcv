/**
 * Workflow Engine Tests - B140B-AGENT-019
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { WorkflowEngine, WorkflowStep, WorkflowStatus, type WorkflowDefinition } from '../workflowEngine';
import { AgentRegistry, AgentProvider, AgentType, AgentScope, RiskTier } from '../registry';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let registry: AgentRegistry;

  beforeEach(() => {
    engine = WorkflowEngine.getInstance();
    registry = AgentRegistry.getInstance();

    registry.clear();
    engine.clearExecutions();

    // Register test agents
    registry.register({
      id: 'planner',
      name: 'Planner Agent',
      provider: AgentProvider.OPENAI,
      type: AgentType.LLM,
      scopes: [AgentScope.READ],
      riskTier: RiskTier.LOW,
      capabilities: ['planning', 'analysis'],
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    });

    registry.register({
      id: 'implementer',
      name: 'Implementer Agent',
      provider: AgentProvider.COPILOT,
      type: AgentType.WORKFLOW,
      scopes: [AgentScope.REPO_READ, AgentScope.REPO_WRITE],
      riskTier: RiskTier.HIGH,
      capabilities: ['refactoring', 'implementation'],
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    });

    registry.register({
      id: 'reviewer',
      name: 'Reviewer Agent',
      provider: AgentProvider.OPENAI,
      type: AgentType.LLM,
      scopes: [AgentScope.READ],
      riskTier: RiskTier.MEDIUM,
      capabilities: ['analysis', 'review'],
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    });
  });

  describe('Workflow registration', () => {
    it('should register a workflow', () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
        ],
      };

      const registered = engine.registerWorkflow(workflow);
      expect(registered.id).toBe('test-workflow');
    });

    it('should retrieve registered workflow', () => {
      const workflow: WorkflowDefinition = {
        id: 'retrieve-test',
        name: 'Retrieve Test',
        steps: [],
      };

      engine.registerWorkflow(workflow);
      const retrieved = engine.getWorkflow('retrieve-test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Retrieve Test');
    });
  });

  describe('Workflow execution', () => {
    it('should execute simple workflow', async () => {
      const workflow: WorkflowDefinition = {
        id: 'simple-workflow',
        name: 'Simple Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Planning Step',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.executeWorkflow('simple-workflow');

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(execution.stepResults.length).toBe(1);
      expect(execution.stepResults[0].status).toBe(WorkflowStatus.COMPLETED);
    });

    it('should execute multi-step workflow', async () => {
      const workflow: WorkflowDefinition = {
        id: 'multi-step-workflow',
        name: 'Multi-Step Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
          {
            step: WorkflowStep.IMPLEMENT,
            name: 'Implement',
            requiredCapabilities: ['implementation'],
            requiredScopes: [AgentScope.REPO_WRITE],
            riskLevel: RiskTier.HIGH,
            retries: 0,
            optional: false,
            dependsOn: [WorkflowStep.PLAN],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.executeWorkflow('multi-step-workflow');

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(execution.stepResults.length).toBe(2);
    });

    it('should respect step dependencies', async () => {
      const workflow: WorkflowDefinition = {
        id: 'dependency-workflow',
        name: 'Dependency Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
          {
            step: WorkflowStep.REVIEW,
            name: 'Review',
            requiredCapabilities: ['review'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [WorkflowStep.PLAN],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.executeWorkflow('dependency-workflow');

      expect(execution.stepResults.length).toBe(2);
      const planStep = execution.stepResults.find(r => r.step === WorkflowStep.PLAN);
      const reviewStep = execution.stepResults.find(r => r.step === WorkflowStep.REVIEW);

      expect(planStep).toBeDefined();
      expect(reviewStep).toBeDefined();
      expect(planStep!.startTime.getTime()).toBeLessThan(reviewStep!.startTime.getTime());
    });

    it('should handle optional steps', async () => {
      const workflow: WorkflowDefinition = {
        id: 'optional-workflow',
        name: 'Optional Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
          {
            step: WorkflowStep.REVIEW,
            name: 'Optional Review',
            requiredCapabilities: ['non-existent'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: true,
            dependsOn: [],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.executeWorkflow('optional-workflow');

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
    });

    it('should track execution duration', async () => {
      const workflow: WorkflowDefinition = {
        id: 'duration-workflow',
        name: 'Duration Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.executeWorkflow('duration-workflow');

      expect(execution.duration).toBeDefined();
      expect(execution.duration!).toBeGreaterThanOrEqual(0);
      expect(execution.endTime).toBeDefined();
    });
  });

  describe('Workflow results', () => {
    it('should store step results', async () => {
      const workflow: WorkflowDefinition = {
        id: 'results-workflow',
        name: 'Results Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.executeWorkflow('results-workflow');

      const stepResult = execution.stepResults[0];
      expect(stepResult.result).toBeDefined();
      expect(stepResult.result.stepType).toBe('plan');
    });

    it('should include agent information in results', async () => {
      const workflow: WorkflowDefinition = {
        id: 'agent-info-workflow',
        name: 'Agent Info Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.executeWorkflow('agent-info-workflow');

      const stepResult = execution.stepResults[0];
      expect(stepResult.agentId).toBeDefined();
      expect(stepResult.agentId).toBe('planner');
    });
  });

  describe('Workflow retrieval', () => {
    it('should retrieve execution by id', async () => {
      const workflow: WorkflowDefinition = {
        id: 'retrieval-workflow',
        name: 'Retrieval Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.executeWorkflow('retrieval-workflow');

      const retrieved = engine.getExecution(execution.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(execution.id);
    });

    it('should get executions by workflow id', async () => {
      const workflow: WorkflowDefinition = {
        id: 'multi-exec-workflow',
        name: 'Multi Exec Workflow',
        steps: [
          {
            step: WorkflowStep.PLAN,
            name: 'Plan',
            requiredCapabilities: ['planning'],
            requiredScopes: [AgentScope.READ],
            riskLevel: RiskTier.LOW,
            retries: 0,
            optional: false,
            dependsOn: [],
          },
        ],
      };

      engine.registerWorkflow(workflow);
      await engine.executeWorkflow('multi-exec-workflow');
      await engine.executeWorkflow('multi-exec-workflow');

      const executions = engine.getExecutionsByWorkflow('multi-exec-workflow');
      expect(executions.length).toBe(2);
    });
  });

  describe('Default workflows', () => {
    it('should have FHIR query workflow', () => {
      const workflow = engine.getWorkflow('fhir-query-workflow');
      expect(workflow).toBeDefined();
      expect(workflow?.steps.length).toBeGreaterThan(0);
    });

    it('should have code refactoring workflow', () => {
      const workflow = engine.getWorkflow('code-refactor-workflow');
      expect(workflow).toBeDefined();
      expect(workflow?.steps.some(s => s.step === WorkflowStep.PLAN)).toBe(true);
      expect(workflow?.steps.some(s => s.step === WorkflowStep.PROPOSE)).toBe(true);
      expect(workflow?.steps.some(s => s.step === WorkflowStep.IMPLEMENT)).toBe(true);
      expect(workflow?.steps.some(s => s.step === WorkflowStep.REVIEW)).toBe(true);
    });

    it('should have credential verification workflow', () => {
      const workflow = engine.getWorkflow('credential-verification-workflow');
      expect(workflow).toBeDefined();
    });
  });
});

