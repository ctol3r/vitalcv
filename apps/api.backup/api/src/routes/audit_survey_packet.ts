import { Router } from 'express';
import { pool } from '../db';
import puppeteer from 'puppeteer';

export const surveyPacket = Router();

surveyPacket.get('/api/audit/survey-packet.pdf', async (req, res) => {
  const npi = (req.query.subject_npi || '').toString();
  const from = (req.query.from || '1970-01-01').toString();
  const to = (req.query.to || new Date().toISOString()).toString();

  const ev = await pool.query(
    'SELECT subject_npi, source_name, source_url, method, result, pulled_at, evidence_hash, anchor_tx FROM "VerificationEvent" WHERE ($1=\'\' OR subject_npi=$1) AND pulled_at BETWEEN $2 AND $3 ORDER BY pulled_at DESC',
    [npi, from, to]
  );

  const pf = await pool.query(
    'SELECT tx_hash, root, verified_at FROM "AnchorProof" WHERE verified_at BETWEEN $1 AND $2 ORDER BY verified_at DESC',
    [from, to]
  );

  const html = `<!doctype html>
<meta charset='utf-8'>
<title>Survey Packet</title>
<style>
  body { font-family: system-ui; margin: 24px; }
  h2 { margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
</style>
<h1>Survey Packet</h1>
<p>Filters: NPI=${npi || 'ALL'} | ${from} → ${to}</p>
<h2>NCQA Evidence</h2>
<table>
  <thead>
    <tr>
      <th>NPI</th>
      <th>Source</th>
      <th>Method</th>
      <th>Date</th>
      <th>Hash</th>
      <th>Anchor</th>
    </tr>
  </thead>
  <tbody>${ev.rows.map((r: any) => `
    <tr>
      <td>${r.subject_npi || ''}</td>
      <td><a href='${r.source_url || '#'}'>${r.source_name || ''}</a></td>
      <td>${r.method}</td>
      <td>${r.pulled_at || ''}</td>
      <td>${r.evidence_hash || ''}</td>
      <td>${r.anchor_tx || ''}</td>
    </tr>`).join('')}
  </tbody>
</table>
<h2>Anchor Proofs</h2>
<table>
  <thead>
    <tr>
      <th>Tx Hash</th>
      <th>Root</th>
      <th>Verified</th>
    </tr>
  </thead>
  <tbody>${pf.rows.map((p: any) => `
    <tr>
      <td>${p.tx_hash}</td>
      <td>${p.root || ''}</td>
      <td>${p.verified_at || ''}</td>
    </tr>`).join('')}
  </tbody>
</table>
<p style='margin-top:12px;font-size:11px;opacity:.7'>Generated at ${new Date().toISOString()}</p>`;

  const br = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const pg = await br.newPage();
  await pg.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await pg.pdf({ printBackground: true, format: 'A4' });
  await br.close();

  res.type('application/pdf').send(pdf);
});

