import { pool } from '../agent/db';

/**
 * Deduplicate similar MCPs by comparing embeddings
 * Removes near-duplicate MCPs that are too similar
 *
 * @param threshold - Similarity threshold (0-1), default 0.97 = very similar
 */
export async function dedupe(threshold = 0.97): Promise<{
  checked: number;
  deleted: number;
  duplicates: Array<{ kept: string; deleted: string; similarity: number }>;
}> {
  console.log(`[Dedupe] Finding duplicates with threshold ${threshold}...`);

  const { rows } = await pool.query(
    `SELECT id, name, description, embedding
     FROM "McpTool"
     WHERE embedding IS NOT NULL
     ORDER BY created_at ASC`
  );

  console.log(`[Dedupe] Checking ${rows.length} MCPs...`);

  const toDelete: string[] = [];
  const duplicates: Array<{ kept: string; deleted: string; similarity: number }> = [];

  // Compare each pair
  for (let i = 0; i < rows.length; i++) {
    // Skip if already marked for deletion
    if (toDelete.includes(rows[i].id)) continue;

    for (let j = i + 1; j < rows.length; j++) {
      // Skip if already marked for deletion
      if (toDelete.includes(rows[j].id)) continue;

      const a = rows[i];
      const b = rows[j];

      if (!a.embedding || !b.embedding) continue;

      try {
        // Calculate cosine similarity using pgvector's <=> operator
        // The <=> operator returns distance (0 = identical, 2 = opposite)
        // Similarity = 1 - (distance / 2)
        const simQuery = await pool.query(
          `SELECT 1 - (embedding <=> $2::vector) AS sim
           FROM "McpTool"
           WHERE id = $1`,
          [a.id, b.embedding]
        );

        const similarity = parseFloat(simQuery.rows[0]?.sim || '0');

        if (similarity >= threshold) {
          console.log(
            `[Dedupe] Found duplicate: "${a.name}" ~= "${b.name}" (${similarity.toFixed(3)})`
          );

          toDelete.push(b.id);
          duplicates.push({
            kept: a.name,
            deleted: b.name,
            similarity,
          });
        }
      } catch (error: any) {
        console.error(`[Dedupe] Error comparing ${a.id} and ${b.id}:`, error.message);
      }
    }
  }

  // Delete duplicates
  if (toDelete.length > 0) {
    console.log(`[Dedupe] Deleting ${toDelete.length} duplicates...`);

    const result = await pool.query(
      `DELETE FROM "McpTool" WHERE id = ANY($1::text[])`,
      [toDelete]
    );

    console.log(`[Dedupe] Deleted ${result.rowCount} MCPs`);
  } else {
    console.log('[Dedupe] No duplicates found');
  }

  return {
    checked: rows.length,
    deleted: toDelete.length,
    duplicates,
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  dedupe(0.97)
    .then((stats) => {
      console.log('Deduplication complete:', stats);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Deduplication failed:', error);
      process.exit(1);
    });
}

