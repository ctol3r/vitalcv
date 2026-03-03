/**
 * mcpTool.ts — Wave 46: MCP-compatible tool wrappers for the AKG
 *
 * Exposes the GraphNavigator as MCP tool definitions that can be registered
 * with any MCP-compatible server or agent runtime.
 */

import { graphNavigator, ReadinessResult, NeighborhoodResult } from './graphNavigator';

// ── MCP Tool Interface ────────────────────────────────────────────────────

export interface McpTool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: TInput) => Promise<TOutput>;
}

// ── Tool Input Types ──────────────────────────────────────────────────────

interface ReadinessCheckInput {
  clinicianNodeId: string;
  facilityNodeId: string;
}

interface GraphQueryInput {
  nodeId: string;
  depth?: number;
}

// ── Tool Definitions ──────────────────────────────────────────────────────

export const readinessCheckTool: McpTool<ReadinessCheckInput, ReadinessResult> = {
  name: 'check_clinician_readiness',
  description:
    'Determines if a clinician has all required, verified credentials to work at a specific facility by traversing the Authority-Bound Knowledge Graph',
  inputSchema: {
    type: 'object',
    properties: {
      clinicianNodeId: {
        type: 'string',
        description: 'UUID of the clinician KnowledgeNode',
      },
      facilityNodeId: {
        type: 'string',
        description: 'UUID of the facility KnowledgeNode',
      },
    },
    required: ['clinicianNodeId', 'facilityNodeId'],
    additionalProperties: false,
  },
  execute: async (input: ReadinessCheckInput): Promise<ReadinessResult> => {
    return graphNavigator.evaluateReadinessPath(input.clinicianNodeId, input.facilityNodeId);
  },
};

export const graphQueryTool: McpTool<GraphQueryInput, NeighborhoodResult> = {
  name: 'query_authority_graph',
  description: 'Explores the authority graph neighborhood around a given entity',
  inputSchema: {
    type: 'object',
    properties: {
      nodeId: {
        type: 'string',
        description: 'UUID of the KnowledgeNode to explore from',
      },
      depth: {
        type: 'number',
        description: 'How many hops to traverse (default: 1, max: 4)',
        default: 1,
      },
    },
    required: ['nodeId'],
    additionalProperties: false,
  },
  execute: async (input: GraphQueryInput): Promise<NeighborhoodResult> => {
    const depth = Math.min(input.depth ?? 1, 4);
    return graphNavigator.getNodeNeighborhood(input.nodeId, depth);
  },
};
