import { Router } from 'express';
import { exec } from 'child_process';
import { pool } from '../db';

export const demoSc = Router();

const SCENARIOS = [
  {
    id: 'physician-imlc-tele',
    label: 'Physician • IMLC • Telehealth',
    seeds: { domain: 1, physician: 1, compacts: 1, staterules: 1 },
    flags: { 'streams.enabled': true }
  },
  {
    id: 'psych-psypact-tele',
    label: 'Psych • PSYPACT • Telepsychology',
    seeds: { domain: 1, trace: 1, compacts: 1 },
    flags: { 'streams.enabled': true }
  },
  {
    id: 'aprn-compact',
    label: 'APRN • Compact',
    seeds: { domain: 1, compacts: 1, staterules: 1 },
    flags: {}
  },
  {
    id: 'pharmacist-exams',
    label: 'Pharmacist • NAPLEX/MPJE',
    seeds: { domain: 1, exams: 1 },
    flags: {}
  }
];

function run(cmd: string) {
  return new Promise<string>((ok) =>
    exec(cmd, { cwd: process.cwd() }, (_e, so, se) => ok((so || se || '').trim()))
  );
}

demoSc.get('/api/dev/demo-scenarios', (_req, res) => res.json({ rows: SCENARIOS }));

demoSc.post('/api/dev/demo-scenarios/apply', async (req, res) => {
  const id = (req.body?.id || '').toString();
  const s = SCENARIOS.find(x => x.id === id);
  if (!s) return res.status(404).json({ ok: false, error: 'unknown_scenario' });

  await pool.query(
    "DELETE FROM \"AgentTrace\" WHERE task_type LIKE 'demo.%' OR input->>'licensePdfId'='demo'"
  );

  const out: any = {};
  const seeds = s.seeds || {};

  async function maybe(k: string, cmd: string) {
    if ((seeds as any)[k]) out[k] = await run(cmd);
  }

  await maybe('domain', 'pnpm tsx scripts/seed_domain_packs.ts || true');
  await maybe('physician', 'pnpm tsx scripts/seed_physician_instant.ts || true');
  await maybe('trace', 'pnpm tsx scripts/seed_trace.ts || true');
  await maybe('compacts', 'pnpm tsx scripts/load_compacts.ts || true');
  await maybe('staterules', 'pnpm tsx scripts/load_state_rules.ts || true');
  await maybe('exams', 'pnpm tsx scripts/exams_adoption_sync.ts || true');

  // flags
  for (const [k, v] of Object.entries(s.flags || {})) {
    await pool.query(
      'INSERT INTO "RuntimeFlag"(key,value,updated_at) VALUES($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()',
      [k, v]
    );
  }

  res.json({ ok: true, scenario: s, out });
});

