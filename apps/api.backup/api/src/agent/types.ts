import { z } from "zod";

/**
 * MCP (Model Context Protocol) Manifest Schema
 * Defines a reusable agent workflow/tool
 */
export const McpManifest = z.object({
  name: z.string(),
  description: z.string(),
  inputs: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean().default(true),
    })
  ),
  outputs: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
    })
  ),
  steps: z.array(
    z.object({
      tool: z.string(), // registered tool name (ocr, npiLookup, verifyBoard, etc.)
      params: z.record(z.any()).optional(),
    })
  ),
  scope: z.string(), // 'global' | 'domain:...' | 'user:...'
  tags: z.array(z.string()).default([]),
});

export type McpManifestT = z.infer<typeof McpManifest>;

/**
 * Agent Trace: Execution record for learning
 */
export type AgentTrace = {
  task_type: string;
  user_id?: string;
  domain?: string;
  input: any;
  steps: any[];
  outcome: {
    success: boolean;
    notes?: string;
    metrics?: Record<string, any>;
  };
};

/**
 * MCP Tool Record (from database)
 */
export type McpTool = {
  id: string;
  name: string;
  description: string;
  scope: string;
  tags: string[];
  code?: string;
  manifest: McpManifestT;
  reliability_score: number;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
  score?: number; // added during search
};

