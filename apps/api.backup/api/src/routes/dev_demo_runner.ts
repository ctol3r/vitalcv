import { Router } from 'express';
import { pool } from '../db';
import puppeteer from 'puppeteer';
import { adminGuard } from '../middleware/admin_guard';
import { retry } from '../util/retry';
import * as path from 'path';
import * as fs from 'fs';

export const demoRunner = Router();

// Get retry config from step or env defaults
function getRetryConfig(step: any) {
  const times = Number(
    step.retry?.times ??
    process.env.DEMO_RETRY_TIMES ??
    2
  );
  const backoff = Number(
    step.retry?.interval_ms ??
    process.env.DEMO_RETRY_BACKOFF_MS ??
    300
  );
  return { times, backoff };
}

async function runSteps(steps: any[]) {
  const br = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });
  const pg = await br.newPage();
  const base = 'http://localhost:' + (process.env.FRONTEND_PORT || '3000').toString();
  const results: any[] = [];
  const t0 = Date.now();

  // Ensure screenshots directory exists
  const screenshotDir = path.join(process.cwd(), 'demo_screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const st = Date.now();
    let status = 'pass';
    let err = '';
    let screenshotPath = '';

    try {
      const { times, backoff } = getRetryConfig(s);

      if (s.type === 'navigate') {
        await retry(async () => {
          await pg.goto(base + s.value, { waitUntil: 'networkidle0' });
        }, times, backoff);
      } else if (s.type === 'wait') {
        await pg.waitForTimeout(Number(s.ms || 0));
      } else if (s.type === 'click') {
        await retry(async () => {
          await pg.click(s.selector);
        }, times, backoff);
      } else if (s.type === 'type') {
        await retry(async () => {
          await pg.type(s.selector, s.text || '');
        }, times, backoff);
      } else if (s.type === 'expectText') {
        await retry(async () => {
          const txt = await pg.$eval(s.selector, (el: any) => el.textContent || '');
          if (!(txt || '').includes(s.text)) {
            throw new Error(`Expected text includes "${s.text}", got "${txt}"`);
          }
        }, times, backoff);
      } else if (s.type === 'expectVisible') {
        await retry(async () => {
          const box = await pg.$(s.selector);
          if (!box) throw new Error('Element not found');
        }, times, backoff);
      } else if (s.type === 'expectCount') {
        await retry(async () => {
          const n = await pg.$$eval(s.selector, (els: any[]) => els.length);
          if (n !== Number(s.n || 0)) {
            throw new Error(`Expected count ${s.n}, got ${n}`);
          }
        }, times, backoff);
      }
    } catch (e: any) {
      status = 'fail';
      err = String(e?.message || e);

      // Capture screenshot on failure
      try {
        screenshotPath = path.join(screenshotDir, `demo_fail_step${i}_${Date.now()}.png`);
        await pg.screenshot({ path: screenshotPath, fullPage: true });
        err += ` (screenshot: ${screenshotPath})`;
      } catch (screenshotErr) {
        console.error('Failed to capture screenshot:', screenshotErr);
      }
    }

    results.push({
      idx: i,
      step: s,
      status,
      duration_ms: Date.now() - st,
      error: err || null,
      screenshot: screenshotPath || null
    });

    if (status === 'fail') break;
  }

  await br.close();

  return {
    status: results.every((r) => r.status === 'pass') ? 'pass' : 'fail',
    steps: results,
    duration_ms: Date.now() - t0
  };
}

demoRunner.post('/api/dev/demo/run-headless', adminGuard, async (req, res) => {
  const id = (req.body?.script_id || '').toString();
  const sc = (
    await pool.query('SELECT id,name,steps FROM "DemoScript" WHERE id=$1', [id])
  ).rows[0];

  if (!sc) return res.status(404).json({ ok: false });

  const r = (
    await pool.query(
      'INSERT INTO "DemoRun"(script_id,name,status,summary) VALUES($1,$2,$3,$4) RETURNING id',
      [sc.id, sc.name, 'running', {}]
    )
  ).rows[0];

  const exec = await runSteps(sc.steps || []);

  await pool.query(
    'UPDATE "DemoRun" SET finished_at=now(), status=$2, summary=$3 WHERE id=$1',
    [r.id, exec.status, exec]
  );

  for (const st of exec.steps) {
    await pool.query(
      'INSERT INTO "DemoRunStep"(run_id,idx,step,status,duration_ms,error) VALUES($1,$2,$3,$4,$5,$6)',
      [r.id, st.idx, st.step, st.status, st.duration_ms, st.error || null]
    );
  }

  res.json({ ok: true, run_id: r.id, status: exec.status, summary: exec });
});

