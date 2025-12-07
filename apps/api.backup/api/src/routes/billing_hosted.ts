import { Router } from 'express';
import { pool } from '../db';

export const billingHosted = Router();

function row(html: string) {
  return `<div style='padding:8px 0;border-bottom:1px solid #eee'>${html}</div>`;
}

// Hosted invoice page
billingHosted.get('/billing/invoice/:id', async (req, res) => {
  // Prevent caching of hosted invoice pages
  res.setHeader('cache-control', 'private, max-age=0, no-store');

  const { rows } = await pool.query('SELECT * FROM "Invoice" WHERE id=$1', [req.params.id]);
  const inv = rows[0];
  if (!inv) return res.status(404).send('Not found');

  const html = `<!doctype html>
<meta charset='utf-8'>
<title>Invoice ${inv.id}</title>
<style>body{font-family:system-ui;margin:24px;color:#111}</style>
<h1>VitalCV</h1>
<h3>Invoice • ${inv.month}</h3>
${row(`<b>Org:</b> ${inv.org_id}`)}
${row(`<b>Status:</b> ${inv.status}`)}
${row(`<b>Subtotal:</b> ${inv.currency} ${inv.subtotal}`)}
${row(`<b>Tax:</b> ${inv.currency} ${inv.tax}`)}
${row(`<b>Total:</b> ${inv.currency} ${inv.total}`)}
<p style='margin-top:12px'><a href='/billing/invoice/${inv.id}/pdf' target='_blank'>Download PDF</a></p>`;

  res.type('text/html').send(html);
});

