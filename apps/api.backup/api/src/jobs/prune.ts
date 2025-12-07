import { pool } from '../db';

/**
 * Prune stale MCPs and old traces
 * Run this job periodically (e.g., daily cron)
 */
export async function prune() {
  // Delete unused MCPs older than 30 days
  await pool.query(
    'DELETE FROM "McpTool" WHERE usage_count=0 AND created_at < now()-interval \'30 days\''
  );

  // Delete traces older than 90 days
  await pool.query(
    'DELETE FROM "AgentTrace" WHERE created_at < now()-interval \'90 days\''
  );

  console.log('Pruning complete');
}

// Allow running as standalone script
if (require.main === module) {
  prune()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Pruning error:', err);
      process.exit(1);
    });
}

