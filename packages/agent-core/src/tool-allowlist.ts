/**
 * Agent tool allowlist and purpose tag enforcement
 * Server-side enforcement of tool permissions per agent
 */

export interface ToolDefinition {
  /** Tool identifier */
  id: string;
  /** Tool name */
  name: string;
  /** Purpose tags (e.g., 'read', 'write', 'admin', 'phi-access') */
  purposeTags: string[];
  /** Allowed agents (empty = all agents) */
  allowedAgents?: string[];
  /** Blocked agents */
  blockedAgents?: string[];
}

export interface AgentToolCall {
  agentId: string;
  tool: string;
  params: Record<string, unknown>;
  purpose?: string;
  timestamp: number;
}

export interface ToolAllowlistConfig {
  /** Tool definitions */
  tools: ToolDefinition[];
  /** Default purpose tags for agents */
  defaultPurposeTags?: string[];
  /** Require purpose tag on all calls (default: true) */
  requirePurposeTag?: boolean;
}

/**
 * Tool allowlist manager
 */
export class ToolAllowlistManager {
  private config: ToolAllowlistConfig;
  private toolMap: Map<string, ToolDefinition>;

  constructor(config: ToolAllowlistConfig) {
    this.config = config;
    this.toolMap = new Map();

    // Build tool map
    config.tools.forEach(tool => {
      this.toolMap.set(tool.id, tool);
    });
  }

  /**
   * Check if agent can call tool
   */
  canCallTool(agentId: string, toolId: string, purpose?: string): { allowed: boolean; reason?: string } {
    const tool = this.toolMap.get(toolId);

    if (!tool) {
      return {
        allowed: false,
        reason: `Tool '${toolId}' not found in allowlist`,
      };
    }

    // Check blocked agents
    if (tool.blockedAgents && tool.blockedAgents.includes(agentId)) {
      return {
        allowed: false,
        reason: `Agent '${agentId}' is blocked from using tool '${toolId}'`,
      };
    }

    // Check allowed agents (if specified)
    if (tool.allowedAgents && tool.allowedAgents.length > 0) {
      if (!tool.allowedAgents.includes(agentId)) {
        return {
          allowed: false,
          reason: `Agent '${agentId}' not in allowed list for tool '${toolId}'`,
        };
      }
    }

    // Check purpose tag requirement
    if (this.config.requirePurposeTag !== false) {
      if (!purpose) {
        return {
          allowed: false,
          reason: `Purpose tag required for tool '${toolId}'`,
        };
      }

      // Validate purpose tag matches tool's purpose tags
      if (tool.purposeTags.length > 0 && !tool.purposeTags.includes(purpose)) {
        return {
          allowed: false,
          reason: `Purpose '${purpose}' not allowed for tool '${toolId}'. Allowed: ${tool.purposeTags.join(', ')}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validate tool call
   */
  validateToolCall(call: AgentToolCall): { allowed: boolean; reason?: string } {
    return this.canCallTool(call.agentId, call.tool, call.purpose);
  }
}

/**
 * Express middleware for tool allowlist enforcement
 */
export function createToolAllowlistMiddleware(manager: ToolAllowlistManager) {
  return async (req: any, res: any, next: any) => {
    const toolCall: AgentToolCall = req.body;

    if (!toolCall || !toolCall.agentId || !toolCall.tool) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing agentId or tool in request',
      });
    }

    const result = manager.validateToolCall(toolCall);

    if (!result.allowed) {
      // Audit blocked tool call
      console.log('[AUDIT] Tool call blocked:', {
        agentId: toolCall.agentId,
        tool: toolCall.tool,
        purpose: toolCall.purpose,
        reason: result.reason,
        timestamp: Date.now(),
      });

      return res.status(403).json({
        error: 'tool_call_blocked',
        error_description: result.reason,
        agentId: toolCall.agentId,
        tool: toolCall.tool,
      });
    }

    // Attach validation result to request
    req.toolCallValidated = true;
    req.toolDefinition = manager['toolMap'].get(toolCall.tool);

    next();
  };
}

/**
 * Default tool definitions
 */
export const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    id: 'npi.lookup',
    name: 'NPI Lookup',
    purposeTags: ['read', 'verify'],
  },
  {
    id: 'credential.issue',
    name: 'Issue Credential',
    purposeTags: ['write', 'admin'],
    allowedAgents: ['issuer-agent'],
  },
  {
    id: 'credential.verify',
    name: 'Verify Credential',
    purposeTags: ['read', 'verify'],
  },
  {
    id: 'claim.create',
    name: 'Create Claim',
    purposeTags: ['write'],
  },
  {
    id: 'phi.access',
    name: 'Access PHI',
    purposeTags: ['read', 'phi-access'],
    blockedAgents: ['public-agent'], // Example: block public agents from PHI
  },
];

/**
 * Create default tool allowlist manager
 */
export function createDefaultToolAllowlistManager(): ToolAllowlistManager {
  return new ToolAllowlistManager({
    tools: DEFAULT_TOOLS,
    requirePurposeTag: true,
  });
}

