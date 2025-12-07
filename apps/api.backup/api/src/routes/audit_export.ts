import { Router } from 'express';
import { pool } from '../db';
import { format } from '@fast-csv/format';

export const auditExport = Router();

auditExport.get('/audit/export.ndjson', async (req, res) => {
  const org = String(req.query.org || 'default');
  res.setHeader('content-type', 'application/x-ndjson');

  const q = await pool.query(
    `SELECT * FROM "AgentAudit"
     WHERE (details->>'org_id')=$1 OR $1='default'
     ORDER BY ts DESC LIMIT 10000`,
    [org]
  );

  q.rows.forEach(r => res.write(JSON.stringify(r) + '\n'));
  res.end();
});

auditExport.get('/audit/export.csv', async (req, res) => {
  const org = String(req.query.org || 'default');
  res.setHeader('content-type', 'text/csv');

  const csv = format({ headers: true });
  csv.pipe(res);

  const q = await pool.query(
    `SELECT * FROM "AgentAudit"
     WHERE (details->>'org_id')=$1 OR $1='default'
     ORDER BY ts DESC LIMIT 10000`,
    [org]
  );

  q.rows.forEach(r => csv.write(r));
  csv.end();
});

