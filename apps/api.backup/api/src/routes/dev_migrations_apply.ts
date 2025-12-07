import { Router } from 'express';
import { exec } from 'child_process';
import { adminGuard } from '../middleware/admin_guard';

export const devMigrateApply = Router();

devMigrateApply.post('/dev/migrations/apply', adminGuard, (_req, res) => {
  if (process.env.DEV_ALLOW_MIGRATE !== '1') {
    return res.status(403).json({ ok: false, error: 'guard_disabled' });
  }

  exec('pnpm dlx prisma migrate deploy', { cwd: process.cwd() }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
    res.json({ ok: true, stdout, stderr });
  });
});

