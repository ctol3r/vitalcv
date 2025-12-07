import { pool } from './db';

export async function pinStable(name: string, label = 'stable') {
  await pool.query(
    'UPDATE "McpTool" SET tags = array_append(tags,$2) WHERE name=$1 AND NOT tags @> ARRAY[$2]::text[]',
    [name, label]
  );
  await pool.query(
    'UPDATE "McpTool" SET reliability_score = reliability_score + 1 WHERE name=$1',
    [name]
  );
}
