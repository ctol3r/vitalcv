import { pool } from '../db';

/**
 * Promote an MCP to native tool status
 * Flags the MCP as promoted so ops can later replace with optimized implementation
 */
export async function promoteMcp(name: string) {
  await pool.query(
    'UPDATE "McpTool" SET tags = array_append(tags, $2) WHERE name=$1 AND NOT tags @> ARRAY[$2]::text[]',
    [name, 'promoted']
  );
}

