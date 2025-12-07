import { Router } from 'express';
import { pool } from '../db';

export const invoicePdf = Router();

// Generic PDF endpoint (header-based)
invoicePdf.get('/billing/invoice/pdf', async (req, res) => {
  const org = (req.headers['x-org-id'] || 'default').toString();
  const month = new Date().toISOString().slice(0, 7);
  const html = `<!doctype html><meta charset='utf-8'><title>Invoice</title><style>body{font-family:system-ui;margin:24px}h1{margin:0}small{opacity:.7}</style><h1>VitalCV</h1><small>Invoice for ${org} — ${month}</small><hr/><p>Line item: Usage</p><p>(Preview PDF; integrate real renderer later)</p>`;
  res.type('text/html').send(html);
});

// ID-based PDF endpoint for hosted invoices
invoicePdf.get('/billing/invoice/:id/pdf', async (req, res) => {
  const id = req.params.id;
  const org = (req.headers['x-org-id'] || 'default').toString();
  const month = new Date().toISOString().slice(0, 7);
  const html = `<!doctype html><meta charset='utf-8'><title>Invoice</title><style>body{font-family:system-ui;margin:24px}h1{margin:0}small{opacity:.7}</style><h1>VitalCV</h1><small>Invoice ${id} for ${org} — ${month}</small><hr/><p>Line item: Usage (preview)</p>`;
  // Hook: forward to PDF microservice later
  res.type('text/html').send(html);
});

