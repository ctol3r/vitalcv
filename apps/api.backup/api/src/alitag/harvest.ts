import { pool } from '../db';

export async function logSuccess(domain: string, signal: string, payload: any) {
  await pool.query(
    'INSERT INTO "AgentLog"(domain, signal, payload, created_at) VALUES($1, $2, $3, now())',
    [domain, signal, payload]
  );
}

