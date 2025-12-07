/**
 * Agent Registry Tests - B140B-AGENT-017
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AgentRegistry,
  AgentProvider,
  AgentType,
  AgentScope,
  RiskTier,
  type AgentRecord,
} from '../registry';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = AgentRegistry.getInstance();
    registry.clear();
  });

  describe('CRUD operations', () => {
    it('should register a new agent', () => {
      const agent: AgentRecord = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        provider: AgentProvider.OPENAI,
        type: AgentType.LLM,
        scopes: [AgentScope.READ],
        riskTier: RiskTier.LOW,
        capabilities: ['test'],
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['test'],
      };

      const registered = registry.register(agent);
      expect(registered.id).toBe('test-agent');
      expect(registered.provider).toBe(AgentProvider.OPENAI);
    });

    it('should throw error when registering duplicate agent', () => {
      const agent: AgentRecord = {
        id: 'duplicate-agent',
        name: 'Duplicate Agent',
        provider: AgentProvider.OPENAI,
        type: AgentType.LLM,
        scopes: [AgentScope.READ],
        riskTier: RiskTier.LOW,
        capabilities: [],
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      };

      registry.register(agent);
      expect(() => registry.register(agent)).toThrow();
    });

    it('should get agent by id', () => {
      const agent: AgentRecord = {
        id: 'get-test',
        name: 'Get Test Agent',
        provider: AgentProvider.COPILOT,
        type: AgentType.WORKFLOW,
        scopes: [AgentScope.REPO_READ],
        riskTier: RiskTier.MEDIUM,
        capabilities: ['refactoring'],
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      };

      registry.register(agent);
      const retrieved = registry.get('get-test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Get Test Agent');
    });

    it('should update existing agent', () => {
      const agent: AgentRecord = {
        id: 'update-test',
        name: 'Original Name',
        provider: AgentProvider.OPENAI,
        type: AgentType.LLM,
        scopes: [AgentScope.READ],
        riskTier: RiskTier.LOW,
        capabilities: [],
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      };

      registry.register(agent);
      const updated = registry.update('update-test', { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
    });

    it('should delete agent', () => {
      const agent: AgentRecord = {
        id: 'delete-test',
        name: 'Delete Test',
        provider: AgentProvider.OPENAI,
        type: AgentType.LLM,
        scopes: [AgentScope.READ],
        riskTier: RiskTier.LOW,
        capabilities: [],
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      };

      registry.register(agent);
      const deleted = registry.delete('delete-test');
      expect(deleted).toBe(true);
      expect(registry.get('delete-test')).toBeUndefined();
    });
  });

  describe('Query operations', () => {
    beforeEach(() => {
      // Register test agents
      registry.register({
        id: 'openai-low',
        name: 'OpenAI Low Risk',
        provider: AgentProvider.OPENAI,
        type: AgentType.LLM,
        scopes: [AgentScope.READ, AgentScope.FHIR_QUERY],
        riskTier: RiskTier.LOW,
        capabilities: ['fhir-query'],
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['test'],
      });

      registry.register({
        id: 'copilot-high',
        name: 'Copilot High Risk',
        provider: AgentProvider.COPILOT,
        type: AgentType.WORKFLOW,
        scopes: [AgentScope.REPO_WRITE, AgentScope.PR_CREATE],
        riskTier: RiskTier.HIGH,
        capabilities: ['refactoring', 'pr-creation'],
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['test'],
      });

      registry.register({
        id: 'disabled-agent',
        name: 'Disabled Agent',
        provider: AgentProvider.OPENCODE,
        type: AgentType.LLM,
        scopes: [AgentScope.READ],
        riskTier: RiskTier.LOW,
        capabilities: [],
        enabled: false,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['test'],
      });
    });

    it('should get all agents', () => {
      const agents = registry.getAll();
      expect(agents.length).toBe(3);
    });

    it('should get agents by provider', () => {
      const openaiAgents = registry.getByProvider(AgentProvider.OPENAI);
      expect(openaiAgents.length).toBe(1);
      expect(openaiAgents[0].id).toBe('openai-low');
    });

    it('should get agents by type', () => {
      const workflowAgents = registry.getByType(AgentType.WORKFLOW);
      expect(workflowAgents.length).toBe(1);
      expect(workflowAgents[0].id).toBe('copilot-high');
    });

    it('should get agents by risk tier', () => {
      const lowRiskAgents = registry.getByRiskTier(RiskTier.LOW);
      expect(lowRiskAgents.length).toBe(2);
    });

    it('should get agents by scope', () => {
      const fhirAgents = registry.getByScope(AgentScope.FHIR_QUERY);
      expect(fhirAgents.length).toBe(1);
      expect(fhirAgents[0].id).toBe('openai-low');
    });

    it('should get enabled agents only', () => {
      const enabledAgents = registry.getEnabled();
      expect(enabledAgents.length).toBe(2);
      expect(enabledAgents.every(a => a.enabled)).toBe(true);
    });

    it('should check if agent has scope', () => {
      const hasScope = registry.hasScope('openai-low', AgentScope.FHIR_QUERY);
      expect(hasScope).toBe(true);

      const noScope = registry.hasScope('openai-low', AgentScope.ADMIN);
      expect(noScope).toBe(false);
    });

    it('should get agents by capabilities', () => {
      const agents = registry.getByCapabilities(['refactoring']);
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe('copilot-high');
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const invalidAgent = {
        id: '',
        name: 'Invalid',
      } as any;

      expect(() => registry.register(invalidAgent)).toThrow();
    });

    it('should validate enum values', () => {
      const invalidAgent = {
        id: 'invalid-enum',
        name: 'Invalid Enum',
        provider: 'invalid-provider',
        type: AgentType.LLM,
        scopes: [AgentScope.READ],
        riskTier: RiskTier.LOW,
        capabilities: [],
      } as any;

      expect(() => registry.register(invalidAgent)).toThrow();
    });
  });

  describe('Risk tiers', () => {
    it('should enforce risk tier constraints', () => {
      const criticalAgent: AgentRecord = {
        id: 'critical-test',
        name: 'Critical Agent',
        provider: AgentProvider.CUSTOM,
        type: AgentType.WORKFLOW,
        scopes: [AgentScope.ADMIN, AgentScope.EXECUTE],
        riskTier: RiskTier.CRITICAL,
        capabilities: ['admin'],
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['critical'],
      };

      const registered = registry.register(criticalAgent);
      expect(registered.riskTier).toBe(RiskTier.CRITICAL);
      expect(registered.scopes).toContain(AgentScope.ADMIN);
    });
  });

  describe('Rate limiting metadata', () => {
    it('should store rate limit configuration', () => {
      const agent: AgentRecord = {
        id: 'rate-limited',
        name: 'Rate Limited Agent',
        provider: AgentProvider.OPENAI,
        type: AgentType.LLM,
        scopes: [AgentScope.READ],
        riskTier: RiskTier.LOW,
        capabilities: [],
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
          tokensPerMinute: 40000,
        },
        enabled: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      };

      const registered = registry.register(agent);
      expect(registered.rateLimit).toBeDefined();
      expect(registered.rateLimit?.requestsPerMinute).toBe(60);
    });
  });
});

