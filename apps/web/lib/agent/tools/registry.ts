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
 * A2.0 adds a second, orthogonal gate: the ACTOR. A registry is bound to one
 * actor at construction, and a tool the actor may not invoke is refused
 * before its permission is even considered. Two rules, both fail-closed:
 *
 *  - the tool must list this actor in `allowedActors`;
 *  - `system_scheduler` may NEVER execute `execute_with_consent`, whatever a
 *    tool declares. That is doctrine D1 — the agent may do work in the
 *    background but may not disclose in the background — made unrepresentable
 *    rather than merely documented, so a future tool that wrongly lists the
 *    scheduler still cannot send anything.
 *
 * Input and output are validated against the tool's declared schemas,
 * fail-closed: a canonical adapter answering in an unexpected shape is an
 * error, never coerced.
 */
import { isConsentProofShape, type ConsentProof } from '../consent/types';
import { EXECUTION_LEVEL_BY_PERMISSION, type AgentActor } from '../types';
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

export class ToolActorError extends Error {
  readonly toolId: string;
  readonly actor: AgentActor;
  constructor(toolId: string, actor: AgentActor, detail: string) {
    super(`Tool ${toolId} is not available to ${actor}: ${detail}`);
    this.name = 'ToolActorError';
    this.toolId = toolId;
    this.actor = actor;
  }
}

export interface ToolRegistry {
  toolsetVersion: string;
  /** The actor this registry is bound to. */
  actor: AgentActor;
  /** Every registered tool, regardless of actor. */
  list(): AgentTool[];
  /** Only the tools this registry's actor may invoke. */
  availableTools(): AgentTool[];
  /** Whether this registry's actor may invoke the named tool. */
  isAvailable(id: string): boolean;
  get(id: string): AgentTool | undefined;
  execute<O = unknown>(id: string, input: unknown, options?: ToolExecuteOptions): Promise<O>;
}

export interface CreateToolRegistryOptions {
  /** Defaults to a clinician session — the only actor that existed before A2. */
  actor?: AgentActor;
}

export function createToolRegistry(
  tools: AgentTool[],
  options: CreateToolRegistryOptions = {},
): ToolRegistry {
  const actor: AgentActor = options.actor ?? 'clinician_session';
  const byId = new Map<string, AgentTool>();
  for (const tool of tools) {
    if (byId.has(tool.id)) {
      throw new Error(`Duplicate tool id: ${tool.id}`);
    }
    byId.set(tool.id, tool);
  }

  /** The actor gate. Returns the refusal reason, or null when allowed. */
  function actorRefusal(tool: AgentTool): string | null {
    if (actor === 'system_scheduler' && tool.requiredPermission === 'execute_with_consent') {
      // D1, enforced ahead of the tool's own declaration on purpose.
      return 'background runs may never execute a disclosing action';
    }
    // A tool that forgot to declare its actors fails CLOSED to the most
    // restrictive reading rather than throwing or defaulting open. The type
    // makes the declaration mandatory; this is the runtime backstop for
    // anything constructed outside the type checker (fixtures, plugins).
    const allowed = tool.allowedActors ?? ['clinician_session'];
    if (!allowed.includes(actor)) {
      return 'this capability requires a live clinician session';
    }
    return null;
  }

  return {
    toolsetVersion: START_TOOLSET_VERSION,
    actor,
    list: () => [...byId.values()],
    availableTools: () => [...byId.values()].filter((tool) => actorRefusal(tool) === null),
    isAvailable: (id) => {
      const tool = byId.get(id);
      return tool !== undefined && actorRefusal(tool) === null;
    },
    get: (id) => byId.get(id),
    async execute<O = unknown>(id: string, input: unknown, options?: ToolExecuteOptions): Promise<O> {
      const tool = byId.get(id);
      if (!tool) throw new ToolPermissionError(id, 'unknown tool');

      // Actor first: whether this runner may use the capability at all is a
      // prior question to what the capability is allowed to do.
      const refusal = actorRefusal(tool);
      if (refusal) throw new ToolActorError(id, actor, refusal);

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
