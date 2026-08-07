/**
 * Agent tool contract.
 *
 * A tool is a wrapped canonical capability — the canonical adapter (source
 * adapter, ownership service, profile service…) remains the authority for its
 * data; the tool only adds the agent-facing contract: an id, a required
 * permission class, declared input/output schemas, and an execute function.
 * Tools never duplicate adapter logic.
 *
 * Schemas are deliberately dependency-free: a flat field map with required
 * flags, validated structurally at the registry boundary. Rich validation
 * stays inside the canonical adapters where it already lives.
 */
import type { PermissionClass } from '../types';

export type AgentToolFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface AgentToolSchema {
  fields: Record<string, { type: AgentToolFieldType; required?: boolean }>;
}

export interface AgentTool<I = unknown, O = unknown> {
  id: string;
  description: string;
  requiredPermission: PermissionClass;
  inputSchema: AgentToolSchema;
  outputSchema: AgentToolSchema;
  execute(input: I): Promise<O>;
}

export function validateAgainstSchema(value: unknown, schema: AgentToolSchema): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['payload must be an object'];
  }
  const record = value as Record<string, unknown>;
  for (const [field, spec] of Object.entries(schema.fields)) {
    const present = field in record && record[field] !== undefined && record[field] !== null;
    if (!present) {
      if (spec.required) errors.push(`missing required field: ${field}`);
      continue;
    }
    const actual = Array.isArray(record[field]) ? 'array' : typeof record[field];
    if (actual !== spec.type) {
      errors.push(`field ${field}: expected ${spec.type}, got ${actual}`);
    }
  }
  for (const key of Object.keys(record)) {
    if (!(key in schema.fields)) errors.push(`unexpected field: ${key}`);
  }
  return errors;
}
