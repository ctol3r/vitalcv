import { Pool } from "pg";

/**
 * PostgreSQL connection pool for agent operations
 * Separate from Prisma for raw SQL and vector operations
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await pool.end();
});

process.on("SIGINT", async () => {
  await pool.end();
});

