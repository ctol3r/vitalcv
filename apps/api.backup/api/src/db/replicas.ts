import { Pool } from 'pg';

export const writePool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const readPool = new Pool({
  connectionString: process.env.DATABASE_READ_URL || process.env.DATABASE_URL
});

