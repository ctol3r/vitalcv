import { Router } from 'express';
import { pool } from '../db';
import { adminGuard } from '../middleware/admin_guard';

export const rec = Router();

const BUFFERS = new Map<string, any[]>();

function buf(key: string) {
  if (!BUFFERS.has(key)) BUFFERS.set(key, []);
  return BUFFERS.get(key)!;
}

rec.post('/api/dev/demo/record/start', adminGuard, (req, res) => {
  const key = (req.body?.key || 'default').toString();
  BUFFERS.set(key, []);
  res.json({ ok: true, key });
});

rec.post('/api/dev/demo/record/event', adminGuard, (req, res) => {
  const key = (req.body?.key || 'default').toString();
  const step = req.body?.step || {};

  // Handle 'update' event type to modify existing buffered steps
  if (step.type === 'update' && typeof step.idx === 'number') {
    const buffer = buf(key);
    if (buffer[step.idx]) {
      // Merge retry config into existing step
      if (step.retry) {
        buffer[step.idx].retry = {
          ...buffer[step.idx].retry,
          ...step.retry
        };
      }
      return res.json({ ok: true, count: buffer.length, updated: step.idx });
    }
    return res.status(404).json({ ok: false, error: 'Step index not found' });
  }

  // Normal step recording
  buf(key).push({ ...step, ts: Date.now() });
  res.json({ ok: true, count: buf(key).length });
});

rec.post('/api/dev/demo/record/stop', adminGuard, async (req, res) => {
  const key = (req.body?.key || 'default').toString();
  const name = (req.body?.name || ('script-' + Date.now())).toString();
  const author = (req as any).user?.id || 'dev';
  const steps = buf(key);
  await pool.query(
    'INSERT INTO "DemoScript"(name,author,steps,meta) VALUES($1,$2,$3,$4)',
    [name, author, steps, { key }]
  );
  BUFFERS.delete(key);
  res.json({ ok: true, name, count: steps.length });
});

rec.get('/api/dev/demo/scripts', adminGuard, async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id,name,author,created_at,meta FROM "DemoScript" ORDER BY created_at DESC'
  );
  res.json({ rows });
});

rec.get('/api/dev/demo/scripts/:id', adminGuard, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id,name,steps,meta FROM "DemoScript" WHERE id=$1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false });
  res.json(rows[0]);
});

rec.delete('/api/dev/demo/scripts/:id', adminGuard, async (req, res) => {
  await pool.query('DELETE FROM "DemoScript" WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

rec.post('/api/dev/demo/scripts/run', adminGuard, async (req, res) => {
  const id = (req.body?.id || '').toString();
  const { rows } = await pool.query(
    'SELECT steps FROM "DemoScript" WHERE id=$1',
    [id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false });
  res.json({ ok: true, steps: rows[0].steps });
});


