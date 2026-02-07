/**
 * Legacy graph integration.
 * Disabled for MVP and YC demo.
 */
export type Neo4jRunResult = {
  columns: string[];
  data: Array<{ row: Record<string, unknown> }>;
};

export function neo4jConfigured(): boolean {
  return false;
}

export async function neo4jRunCypher(
  _statement: string,
  _parameters: Record<string, unknown> = {},
  _timeoutMs = 0,
): Promise<Neo4jRunResult> {
  throw new Error('Neo4j integration is disabled for MVP and YC demo');
}
