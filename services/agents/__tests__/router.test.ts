/**
 * Agent Router Tests - B140B-AGENT-018
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentRouter, type TaskSpec } from '../router';
import { AgentRegistry, AgentProvider, AgentType, AgentScope, RiskTier, type AgentRecord } from '../registry';

describe('AgentRouter', () => {
  let router: AgentRouter;
  let registry: AgentRegistry;

  beforeEach(() => {
    router = AgentRouter.getInstance();
    registry = AgentRegistry.getInstance();

    registry.clear();
    router.clearHistory();
    router.resetLoad();

    // Register test agents
    registry.register({
      id: 'fhir-reader',
      name: 'FHIR Reader',
      provider: AgentProvider.OPENAI,
      type: AgentType.LLM,
      scopes: [AgentScope.READ, AgentScope.FHIR_QUERY],
      riskTier: RiskTier.LOW,
      capabilities: ['fhir-query', 'read'],
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
      },
    });

    registry.register({
      id: 'fhir-writer',
      name: 'FHIR Writer',
      provider: AgentProvider.OPENAI,
      type: AgentType.LLM,
      scopes: [AgentScope.READ, AgentScope.WRITE, AgentScope.FHIR_QUERY, AgentScope.FHIR_WRITE],
      riskTier: RiskTier.MEDIUM,
      capabilities: ['fhir-query', 'fhir-write', 'read', 'write'],
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      rateLimit: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
      },
    });

    registry.register({
      id: 'refactor-agent',
      name: 'Refactor Agent',
      provider: AgentProvider.COPILOT,
      type: AgentType.WORKFLOW,
      scopes: [AgentScope.REPO_READ, AgentScope.REPO_WRITE, AgentScope.PR_CREATE],
      riskTier: RiskTier.HIGH,
      capabilities: ['refactoring', 'pr-creation', 'code-analysis'],
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
      },
    });
  });

  describe('Single agent routing', () => {
    it('should route task to matching agent', async () => {
      const taskSpec: TaskSpec = {
        id: 'task-1',
        name: 'Query FHIR Resource',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ, AgentScope.FHIR_QUERY],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      const result = await router.route(taskSpec);

      expect(result.selectedAgent).toBeDefined();
      expect(result.selectedAgent).toBe('fhir-reader');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle no matching agents', async () => {
      const taskSpec: TaskSpec = {
        id: 'task-2',
        name: 'Non-existent Capability',
        requiredCapabilities: ['non-existent-capability'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      const result = await router.route(taskSpec);

      expect(result.selectedAgent).toBeUndefined();
      expect(result.reason).toContain('No agents found');
    });

    it('should respect risk tier requirements', async () => {
      const taskSpec: TaskSpec = {
        id: 'task-3',
        name: 'High Risk Task',
        requiredCapabilities: ['refactoring'],
        requiredScopes: [AgentScope.REPO_WRITE],
        riskLevel: RiskTier.HIGH,
        priority: 'high',
      };

      const result = await router.route(taskSpec);

      expect(result.selectedAgent).toBe('refactor-agent');
      const agent = registry.get(result.selectedAgent!);
      expect(agent?.riskTier).toBe(RiskTier.HIGH);
    });

    it('should not allow risk escalation when disabled', async () => {
      const taskSpec: TaskSpec = {
        id: 'task-4',
        name: 'Low Risk Task',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      const result = await router.route(taskSpec, {
        allowRiskEscalation: false,
      });

      expect(result.selectedAgent).toBe('fhir-reader');
      const agent = registry.get(result.selectedAgent!);
      expect(agent?.riskTier).toBe(RiskTier.LOW);
    });
  });

  describe('Multi-agent routing', () => {
    it('should route task to multiple agents', async () => {
      const taskSpec: TaskSpec = {
        id: 'multi-task-1',
        name: 'Multi-Agent Task',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      const result = await router.routeMulti(taskSpec, 2);

      expect(result.selectedAgents).toBeDefined();
      expect(result.selectedAgents!.length).toBeLessThanOrEqual(2);
    });

    it('should limit to available agents', async () => {
      const taskSpec: TaskSpec = {
        id: 'multi-task-2',
        name: 'Request More Than Available',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      const result = await router.routeMulti(taskSpec, 10);

      expect(result.selectedAgents).toBeDefined();
      expect(result.selectedAgents!.length).toBeLessThanOrEqual(3); // Only 3 agents registered
    });
  });

  describe('Policy-driven routing', () => {
    it('should respect preferred providers', async () => {
      const taskSpec: TaskSpec = {
        id: 'policy-task-1',
        name: 'Prefer Copilot',
        requiredCapabilities: ['refactoring'],
        requiredScopes: [AgentScope.REPO_READ],
        riskLevel: RiskTier.HIGH,
        priority: 'medium',
      };

      const result = await router.route(taskSpec, {
        preferredProviders: [AgentProvider.COPILOT],
      });

      expect(result.selectedAgent).toBe('refactor-agent');
      const agent = registry.get(result.selectedAgent!);
      expect(agent?.provider).toBe(AgentProvider.COPILOT);
    });

    it('should exclude specified agents', async () => {
      const taskSpec: TaskSpec = {
        id: 'policy-task-2',
        name: 'Exclude Specific Agent',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      const result = await router.route(taskSpec, {
        excludedAgents: ['fhir-reader'],
      });

      expect(result.selectedAgent).not.toBe('fhir-reader');
    });

    it('should require exact capability match when configured', async () => {
      const taskSpec: TaskSpec = {
        id: 'policy-task-3',
        name: 'Exact Match Required',
        requiredCapabilities: ['fhir-query', 'fhir-write'],
        requiredScopes: [AgentScope.READ, AgentScope.WRITE],
        riskLevel: RiskTier.MEDIUM,
        priority: 'medium',
      };

      const result = await router.route(taskSpec, {
        requireExactMatch: true,
      });

      expect(result.selectedAgent).toBe('fhir-writer');
    });
  });

  describe('Load tracking', () => {
    it('should track agent load', async () => {
      const taskSpec: TaskSpec = {
        id: 'load-task-1',
        name: 'Load Test',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      await router.route(taskSpec);
      const load = router.getAgentLoad('fhir-reader');
      expect(load).toBeGreaterThan(0);
    });

    it('should reset agent load', async () => {
      const taskSpec: TaskSpec = {
        id: 'load-task-2',
        name: 'Reset Load Test',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      await router.route(taskSpec);
      router.resetLoad('fhir-reader');
      const load = router.getAgentLoad('fhir-reader');
      expect(load).toBe(0);
    });
  });

  describe('Routing history', () => {
    it('should record routing decisions', async () => {
      const taskSpec: TaskSpec = {
        id: 'history-task-1',
        name: 'History Test',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      await router.route(taskSpec);
      const history = router.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].taskId).toBe('history-task-1');
    });

    it('should limit history size', async () => {
      const taskSpec: TaskSpec = {
        id: 'history-limit-test',
        name: 'History Limit',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      for (let i = 0; i < 50; i++) {
        await router.route({ ...taskSpec, id: `task-${i}` });
      }

      const history = router.getHistory(10);
      expect(history.length).toBe(10);
    });
  });

  describe('Scoring', () => {
    it('should provide alternatives with scores', async () => {
      const taskSpec: TaskSpec = {
        id: 'score-task-1',
        name: 'Scoring Test',
        requiredCapabilities: ['fhir-query'],
        requiredScopes: [AgentScope.READ],
        riskLevel: RiskTier.LOW,
        priority: 'medium',
      };

      const result = await router.route(taskSpec);

      expect(result.alternatives).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.score!).toBeGreaterThan(0);
      expect(result.score!).toBeLessThanOrEqual(1);
    });
  });
});

