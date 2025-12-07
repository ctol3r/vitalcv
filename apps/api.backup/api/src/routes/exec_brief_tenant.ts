import { Router } from 'express';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import { pool } from '../db';

export const execBriefT = Router();

async function j(u: string) {
  const r = await fetch('http://localhost:' + (process.env.PORT || 4000) + u);
  return await r.json();
}

execBriefT.get('/api/dev/exec-brief/:tenant.html', async (req, res) => {
  const ten = req.params.tenant;
  const status = await j('/dev/status');
  const checklist = await j('/dev/checklist');
  const comp = await j('/api/compliance/snapshot');
  const cov = await j('/api/compacts/coverage');

  const ev = (await pool.query(
    'SELECT subject_npi,source_name,method,pulled_at,evidence_hash,anchor_tx FROM "VerificationEvent" WHERE ($1=\'\' OR (result->>\'tenant_id\')=$1) ORDER BY pulled_at DESC LIMIT 50',
    [ten]
  )).rows;

  const vr = (await pool.query(
    'SELECT ts,request,result FROM "VerifyResultLog" ORDER BY ts DESC LIMIT 20'
  )).rows; // demo: not always tenant-tagged

  const html = `<!doctype html>
<meta charset='utf-8'>
<title>Exec Brief — ${ten}</title>
<style>
  body{font-family:system-ui;margin:24px}
  .card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:8px 0}
  h2{margin:6px 0}
</style>
<h1>Executive Brief — ${ten}</h1>
<div class='card'><h2>Status</h2><pre>${JSON.stringify(status, null, 2)}</pre></div>
<div class='card'><h2>Checklist</h2><pre>${JSON.stringify(checklist, null, 2)}</pre></div>
<div class='card'><h2>Compliance Snapshot</h2><pre>${JSON.stringify(comp, null, 2)}</pre></div>
<div class='card'><h2>Compact Coverage</h2><pre>${JSON.stringify(cov, null, 2)}</pre></div>
<div class='card'><h2>Recent Verifies</h2><pre>${JSON.stringify(vr, null, 2)}</pre></div>
<div class='card'><h2>Evidence (tenant-scoped)</h2><pre>${JSON.stringify(ev, null, 2)}</pre></div>
<div class='card' style='font-size:12px;opacity:.7'>Generated ${new Date().toLocaleString()}</div>`;

  res.type('text/html').send(html);
});

execBriefT.get('/api/dev/exec-brief/:tenant.pdf', async (req, res) => {
  const url = `http://localhost:${process.env.PORT || 4000}/api/dev/exec-brief/${req.params.tenant}.html`;
  const br = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const pg = await br.newPage();
  await pg.goto(url, { waitUntil: 'networkidle0' });
  const pdf = await pg.pdf({ printBackground: true, format: 'A4' });
  await br.close();
  res.type('application/pdf').send(pdf);
});

