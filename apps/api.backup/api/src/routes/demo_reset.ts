import { exec } from 'child_process';
import { Router } from 'express';
import { pool } from '../agent/db';
import { adminGuard } from '../middleware/admin_guard';

export const demoReset = Router();

function run(cmd: string) {
  return new Promise<string>((ok) =>
    exec(cmd, { cwd: process.cwd() }, (_e, so, se) => ok((so || se || '').trim())),
  );
}

demoReset.post('/ops/demo-reset', adminGuard, async (req, res) => {
  const seeds = req.body?.seeds || {};

  // Wipe demo data
  await pool.query(
    "DELETE FROM \"AgentTrace\" WHERE task_type LIKE 'demo.%' OR input->>'licensePdfId'='demo'",
  );
  await pool.query('DELETE FROM "VerificationEvent" WHERE subject_npi=\'DEMO\'').catch(() => {});

  let out: any = { wiped: true };

  async function maybe(key: string, cmd: string) {
    if (seeds[key]) out[key] = await run(cmd);
  }

  // Legacy support for ?reseed=1
  if (String(req.query.reseed || '0') === '1') {
    seeds.domain = seeds.physician = seeds.trace = true;
  }

  await maybe('domain', 'pnpm tsx scripts/seed_domain_packs.ts || true');
  await maybe('physician', 'pnpm tsx scripts/seed_physician_instant.ts || true');
  await maybe('trace', 'pnpm tsx scripts/seed_trace.ts || true');
  await maybe('compacts', 'pnpm tsx scripts/load_compacts.ts || true');
  await maybe('staterules', 'pnpm tsx scripts/load_state_rules.ts || true');
  await maybe('exams', 'pnpm tsx scripts/exams_adoption_sync.ts || true');
  await maybe('etl', 'pnpm tsx scripts/etl_residency.ts || true');

  // Batch 62: Log seed history for audit timeline
  try {
    await pool.query(
      'INSERT INTO "SeedHistory"(user_id, seeds, result) VALUES($1, $2, $3)',
      [(req as any).user?.id || 'dev', seeds, out]
    );
  } catch (err) {
    console.error('Failed to log seed history:', err);
  }

  res.json({ ok: true, seeds, out });
});
