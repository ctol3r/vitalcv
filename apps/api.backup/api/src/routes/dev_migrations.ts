import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { pool } from '../agent/db';

export const devMigrations = Router();

devMigrations.get('/dev/migrations', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT migration_name, applied_at, checksum FROM _prisma_migrations ORDER BY applied_at');
    const applied = rows.map(r => r.migration_name);
    const dir = path.join(process.cwd(), 'prisma', 'migrations');
    const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter(d => !d.startsWith('.')) : [];
    const pending = all.filter(m => !applied.includes(m));
    res.json({ ok: true, applied: rows, pending });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

