/**
 * Tool registry — the execution boundary for Start Agent tools.
 *
 * Execution ceiling by wave:
 *  - Levels 0–2 (observe/recommend/prepare) execute directly.
 *  - Level 3 (`execute_with_consent`) executes ONLY when the caller supplies
 *    a `ConsentProof` — minted by the consent store from a ledger read at
 *    execution time (A1). The proof's scope must match the consent scope the
 *    tool invocation names, and its shape is validated here fail-closed.
 *    A missing, malformed, or wrong-scope proof throws; there is no flag
 *    that bypasses this.
 *  - Level 4 (`human_only`) is not executable by definition, ever.
 *
 * Input and output are validated against the tool's declared schemas,
 * fail-closed: a canonical adapter answering in an unexpected shape is an
 * error, never coerced.
 */
import { isConsentProofShape, type ConsentProof } from '../consent/types';
import { EXECUTION_LEVEL_BY_PERMISSION } from '../types';
import { validateAgainstSchema, type AgentTool } from './contract';

export const START_TOOLSET_VERSION = 'start-toolset-v2';

/** Levels 0-2 need no consent; Level 3 needs a verified ConsentProof. */
const MAX_UNCONSENTED_LEVEL = 2;

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

export interface ToolExecuteOptions {
  /**
   * Required for Level 3 tools. Never client-supplied — the execution
   * service mints it via the consent store immediately before this call.
   */
  consentProof?: ConsentProof;
}

export interface ToolRegistry {
  toolsetVersion: string;
  list(): AgentTool[];
  get(id: string): AgentTool | undefined;
  execute<O = unknown>(id: string, input: unknown, options?: ToolExecuteOptions): Promise<O>;
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
    async execute<O = unknown>(id: string, input: unknown, options?: ToolExecuteOptions): Promise<O> {
      const tool = byId.get(id);
      if (!tool) throw new ToolPermissionError(id, 'unknown tool');

      const level = EXECUTION_LEVEL_BY_PERMISSION[tool.requiredPermission];
      if (tool.requiredPermission === 'human_only') {
        throw new ToolPermissionError(id, 'human_only capabilities are never executable by the agent');
      }
      if (level > MAX_UNCONSENTED_LEVEL) {
        const proof = options?.consentProof;
        if (!proof) {
          throw new ToolPermissionError(
            id,
            `requires Level ${level} (${tool.requiredPermission}); execution without a verified ConsentProof is refused`,
          );
        }
        if (!isConsentProofShape(proof)) {
          throw new ToolPermissionError(id, 'consent proof is malformed');
        }
        const namedScope =
          typeof input === 'object' && input !== null
            ? (input as Record<string, unknown>).consentScope
            : undefined;
        if (typeof namedScope !== 'string' || namedScope.length === 0) {
          throw new ToolPermissionError(
            id,
            'Level 3 invocations must name the consentScope they execute under',
          );
        }
        if (proof.scope !== namedScope) {
          throw new ToolPermissionError(
            id,
            `consent proof scope ${proof.scope} does not cover the invoked scope ${namedScope}`,
          );
        }
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
