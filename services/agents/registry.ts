/**
 * Agent Registry - B140B-AGENT-017
 *
 * Defines agent types (LLM, RAG, workflow) with metadata including:
 * - id, provider (OpenAI/Copilot/OpenCode)
 * - scopes (read, write, execute, etc.)
 * - riskTier (low, medium, high, critical)
 * - capabilities, rate limits, and monitoring config
 */

import { z } from 'zod';

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export enum AgentProvider {
  OPENAI = 'openai',
  COPILOT = 'copilot',
  OPENCODE = 'opencode',
  CUSTOM = 'custom',
}

export enum AgentType {
  LLM = 'llm',           // General language model agents
  RAG = 'rag',           // Retrieval-augmented generation
  WORKFLOW = 'workflow', // Multi-step orchestration
  TOOL = 'tool',         // Specialized tool-based agents
}

export enum AgentScope {
  READ = 'read',                     // Read-only operations
  WRITE = 'write',                   // Write operations
  EXECUTE = 'execute',               // Execute code/commands
  FHIR_QUERY = 'fhir:query',        // Query FHIR resources
  FHIR_WRITE = 'fhir:write',        // Write FHIR resources
  PSV_QUERY = 'psv:query',          // Primary source verification queries
  BILLING_READ = 'billing:read',    // Read billing data
  BILLING_WRITE = 'billing:write',  // Modify billing
  REPO_READ = 'repo:read',          // Read repository
  REPO_WRITE = 'repo:write',        // Modify repository
  PR_CREATE = 'pr:create',          // Create pull requests
  ADMIN = 'admin',                  // Administrative operations
}

export enum RiskTier {
  LOW = 'low',           // Minimal risk, read-only
  MEDIUM = 'medium',     // Moderate risk, limited writes
  HIGH = 'high',         // High risk, sensitive data access
  CRITICAL = 'critical', // Critical risk, destructive operations
}

// ============================================================
// SCHEMAS
// ============================================================

export const AgentRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  provider: z.nativeEnum(AgentProvider),
  type: z.nativeEnum(AgentType),
  scopes: z.array(z.nativeEnum(AgentScope)),
  riskTier: z.nativeEnum(RiskTier),

  // Capabilities
  capabilities: z.array(z.string()),
  maxTokens: z.number().optional(),
  model: z.string().optional(),

  // Rate limiting
  rateLimit: z.object({
    requestsPerMinute: z.number(),
    requestsPerHour: z.number(),
    tokensPerMinute: z.number().optional(),
  }).optional(),

  // Configuration
  config: z.record(z.any()).optional(),

  // Metadata
  enabled: z.boolean().default(true),
  version: z.string().default('1.0.0'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  tags: z.array(z.string()).default([]),
});

export type AgentRecord = z.infer<typeof AgentRecordSchema>;

// ============================================================
// AGENT REGISTRY CLASS
// ============================================================

export class AgentRegistry {
  private agents: Map<string, AgentRecord> = new Map();
  private static instance: AgentRegistry;

  private constructor() {
    this.initializeDefaultAgents();
  }

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Register a new agent
   */
  register(agent: AgentRecord): AgentRecord {
    const validated = AgentRecordSchema.parse(agent);

    if (this.agents.has(validated.id)) {
      throw new Error(`Agent with id ${validated.id} already exists`);
    }

    this.agents.set(validated.id, validated);
    return validated;
  }

  /**
   * Update an existing agent
   */
  update(id: string, updates: Partial<AgentRecord>): AgentRecord {
    const existing = this.agents.get(id);
    if (!existing) {
      throw new Error(`Agent with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    const validated = AgentRecordSchema.parse(updated);
    this.agents.set(id, validated);
    return validated;
  }

  /**
   * Get agent by ID
   */
  get(id: string): AgentRecord | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAll(): AgentRecord[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by provider
   */
  getByProvider(provider: AgentProvider): AgentRecord[] {
    return this.getAll().filter(agent => agent.provider === provider);
  }

  /**
   * Get agents by type
   */
  getByType(type: AgentType): AgentRecord[] {
    return this.getAll().filter(agent => agent.type === type);
  }

  /**
   * Get agents by risk tier
   */
  getByRiskTier(riskTier: RiskTier): AgentRecord[] {
    return this.getAll().filter(agent => agent.riskTier === riskTier);
  }

  /**
   * Get agents by scope
   */
  getByScope(scope: AgentScope): AgentRecord[] {
    return this.getAll().filter(agent => agent.scopes.includes(scope));
  }

  /**
   * Get enabled agents only
   */
  getEnabled(): AgentRecord[] {
    return this.getAll().filter(agent => agent.enabled);
  }

  /**
   * Delete agent
   */
  delete(id: string): boolean {
    return this.agents.delete(id);
  }

  /**
   * Check if agent has scope
   */
  hasScope(id: string, scope: AgentScope): boolean {
    const agent = this.agents.get(id);
    return agent ? agent.scopes.includes(scope) : false;
  }

  /**
   * Get agents matching capabilities
   */
  getByCapabilities(capabilities: string[]): AgentRecord[] {
    return this.getAll().filter(agent =>
      capabilities.every(cap => agent.capabilities.includes(cap))
    );
  }

  /**
   * Clear all agents (for testing)
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Initialize default agents
   */
  private initializeDefaultAgents(): void {
    // OpenAI GPT-4 Agent for FHIR queries
    this.register({
      id: 'openai-gpt4-fhir',
      name: 'OpenAI GPT-4 FHIR Agent',
      description: 'GPT-4 agent for FHIR resource queries and analysis',
      provider: AgentProvider.OPENAI,
      type: AgentType.LLM,
      scopes: [AgentScope.READ, AgentScope.FHIR_QUERY],
      riskTier: RiskTier.LOW,
      capabilities: ['fhir-query', 'natural-language', 'analysis'],
      model: 'gpt-4',
      maxTokens: 8000,
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        tokensPerMinute: 40000,
      },
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['fhir', 'healthcare', 'query'],
    });

    // OpenAI GPT-4 Agent for PSV
    this.register({
      id: 'openai-gpt4-psv',
      name: 'OpenAI GPT-4 PSV Agent',
      description: 'GPT-4 agent for primary source verification',
      provider: AgentProvider.OPENAI,
      type: AgentType.RAG,
      scopes: [AgentScope.READ, AgentScope.PSV_QUERY],
      riskTier: RiskTier.MEDIUM,
      capabilities: ['psv-query', 'verification', 'natural-language'],
      model: 'gpt-4',
      maxTokens: 8000,
      rateLimit: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
      },
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['psv', 'verification', 'credentials'],
    });

    // GitHub Copilot for repo refactoring
    this.register({
      id: 'copilot-repo-refactor',
      name: 'GitHub Copilot Refactor Agent',
      description: 'Copilot agent for repository-level refactoring',
      provider: AgentProvider.COPILOT,
      type: AgentType.WORKFLOW,
      scopes: [AgentScope.REPO_READ, AgentScope.REPO_WRITE, AgentScope.PR_CREATE],
      riskTier: RiskTier.HIGH,
      capabilities: ['refactoring', 'pr-creation', 'code-analysis'],
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
      },
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['copilot', 'refactoring', 'automation'],
    });

    // OpenCode automation agent
    this.register({
      id: 'opencode-automation',
      name: 'OpenCode Automation Agent',
      description: 'OpenCode agent for backend task automation',
      provider: AgentProvider.OPENCODE,
      type: AgentType.WORKFLOW,
      scopes: [AgentScope.REPO_READ, AgentScope.REPO_WRITE, AgentScope.EXECUTE],
      riskTier: RiskTier.HIGH,
      capabilities: ['automation', 'code-generation', 'testing'],
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
      },
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['opencode', 'automation', 'backend'],
    });

    // Billing analysis agent (read-only)
    this.register({
      id: 'billing-analyst',
      name: 'Billing Analysis Agent',
      description: 'Agent for billing data analysis and reporting',
      provider: AgentProvider.OPENAI,
      type: AgentType.LLM,
      scopes: [AgentScope.READ, AgentScope.BILLING_READ],
      riskTier: RiskTier.MEDIUM,
      capabilities: ['billing-analysis', 'reporting', 'forecasting'],
      model: 'gpt-4',
      maxTokens: 8000,
      rateLimit: {
        requestsPerMinute: 20,
        requestsPerHour: 300,
      },
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['billing', 'analytics'],
    });

    // Critical admin agent (highly restricted)
    this.register({
      id: 'admin-agent',
      name: 'Administrative Agent',
      description: 'High-privilege agent for administrative tasks',
      provider: AgentProvider.CUSTOM,
      type: AgentType.WORKFLOW,
      scopes: [AgentScope.ADMIN, AgentScope.WRITE, AgentScope.EXECUTE],
      riskTier: RiskTier.CRITICAL,
      capabilities: ['admin', 'system-config', 'user-management'],
      rateLimit: {
        requestsPerMinute: 5,
        requestsPerHour: 50,
      },
      enabled: false, // Disabled by default
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['admin', 'critical'],
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const registry = AgentRegistry.getInstance();
export default registry;

