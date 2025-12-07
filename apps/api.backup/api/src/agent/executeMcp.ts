import { getTool } from "../tools/registry";
import { McpManifestT } from "./types";
import { enqueue, withRetry } from "../tools/exec";

const MAX_STEPS = 20; // Guardrail: prevent infinite loops

/**
 * Execute an MCP workflow with given input arguments
 * Chains tool calls according to the MCP's steps
 */
export async function executeMcp(
  mcp: McpManifestT,
  args: Record<string, any>
): Promise<Record<string, any>> {
  // Guardrail: Enforce maximum step count
  if (mcp.steps.length > MAX_STEPS) {
    throw new Error(`MCP exceeds maximum step count (${MAX_STEPS})`);
  }

  // Guardrail: Validate all tools exist before execution
  for (const step of mcp.steps) {
    const fn = getTool(step.tool);
    if (!fn) {
      throw new Error(`Unknown tool: ${step.tool}`);
    }
  }

  const context: Record<string, any> = { ...args };
  const executionLog: any[] = [];

  try {
    for (const [index, step] of mcp.steps.entries()) {
      const startTime = Date.now();

      // Get the tool function (already validated above)
      const fn = getTool(step.tool)!;

      // Resolve parameters with context substitution
      const resolvedParams = resolveParams(step.params || {}, context);

      console.log(`[MCP ${mcp.name}] Step ${index + 1}: ${step.tool}`, resolvedParams);

      // Round 10: Execute with retry + worker pool for resilience
      await new Promise<void>((resolve, reject) =>
        enqueue(async () => {
          try {
            const output = await withRetry(() => fn({ ...resolvedParams, ...context }));

            // Log execution
            executionLog.push({
              step: index + 1,
              tool: step.tool,
              params: resolvedParams,
              output,
              duration: Date.now() - startTime,
            });

            // Merge outputs back into context for downstream steps
            Object.assign(context, output || {});
            resolve();
          } catch (err) {
            reject(err);
          }
        })
      );
    }

    return {
      success: true,
      output: context,
      executionLog,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
      context,
      executionLog,
    };
  }
}

/**
 * Resolve parameters with template substitution
 * Supports {{paramName}} syntax for context variable injection
 */
function resolveParams(
  params: Record<string, any>,
  context: Record<string, any>
): Record<string, any> {
  const resolved: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
      // Template variable: {{varName}}
      const varName = value.slice(2, -2).trim();
      resolved[key] = context[varName] ?? value;
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Validate MCP inputs against manifest
 */
export function validateMcpInputs(
  mcp: McpManifestT,
  args: Record<string, any>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const input of mcp.inputs) {
    if (input.required && !(input.name in args)) {
      missing.push(input.name);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

