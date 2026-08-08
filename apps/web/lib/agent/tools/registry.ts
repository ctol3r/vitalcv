/**
 * Tool registry — the execution boundary for Start Agent tools.
 *
 * Enforces the A0 execution ceiling: nothing above Level 2 (prepare) runs.
 * Level 3 (`execute_with_consent`) exists in the representation but any
 * attempt to execute it here throws — consented execution is the A1 wave and
 * arrives with its own consent verification, not a registry flag flip.
 * Level 4 (`human_only`) is not executable by definition, ever.
 *
 * Input and output are validated against the tool's declared schemas,
 * fail-closed: a canonical adapter answering in an unexpected shape is an
 * error, never coerced.
 */
import {
  EXECUTION_LEVEL_BY_PERMISSION,
  MAX_EXECUTABLE_LEVEL_A0,
} from '../types';
import { validateAgainstSchema, type AgentTool } from './contract';

export const START_TOOLSET_VERSION = 'start-toolset-v1';

export class ToolPermissionError extends Error {
  constructor(toolId: string, detail: string) {
    super(`Tool ${toolId} refused: ${detail}`);
    this.name = 'ToolPermissionError';
  }
}

export class ToolContractError extends Error {
  constructor(toolId: string, direction: 'input' | 'output', errors: string[]) {
    super(`Tool ${toolId} ${direction} failed schema validation: ${errors.join('; ')}`);
    this.name = 'ToolContractError';
  }
}

export interface ToolRegistry {
  toolsetVersion: string;
  list(): AgentTool[];
  get(id: string): AgentTool | undefined;
  execute<O = unknown>(id: string, input: unknown): Promise<O>;
}

export function createToolRegistry(tools: AgentTool[]): ToolRegistry {
  const byId = new Map<string, AgentTool>();
  for (const tool of tools) {
    if (byId.has(tool.id)) {
      throw new Error(`Duplicate tool id: ${tool.id}`);
    }
    byId.set(tool.id, tool);
  }

  return {
    toolsetVersion: START_TOOLSET_VERSION,
    list: () => [...byId.values()],
    get: (id) => byId.get(id),
    async execute<O = unknown>(id: string, input: unknown): Promise<O> {
      const tool = byId.get(id);
      if (!tool) throw new ToolPermissionError(id, 'unknown tool');

      const level = EXECUTION_LEVEL_BY_PERMISSION[tool.requiredPermission];
      if (tool.requiredPermission === 'human_only') {
        throw new ToolPermissionError(id, 'human_only capabilities are never executable by the agent');
      }
      if (level > MAX_EXECUTABLE_LEVEL_A0) {
        throw new ToolPermissionError(
          id,
          `requires Level ${level} (${tool.requiredPermission}); A0 executes up to Level ${MAX_EXECUTABLE_LEVEL_A0}`,
        );
      }

      const inputErrors = validateAgainstSchema(input, tool.inputSchema);
      if (inputErrors.length > 0) throw new ToolContractError(id, 'input', inputErrors);

      const output = await tool.execute(input);

      const outputErrors = validateAgainstSchema(output, tool.outputSchema);
      if (outputErrors.length > 0) throw new ToolContractError(id, 'output', outputErrors);

      return output as O;
    },
  };
}
