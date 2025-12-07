/**
 * Executive Brief API
 * Aggregates dev status, checklist, compliance, coverage, and verify stats
 * Provides HTML and PDF export via Puppeteer
 */

import { Router } from 'express';
import fetch from 'node-fetch';

export const execBrief = Router();

async function fetchJson(url: string): Promise<any> {
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
    const response = await fetch(baseUrl + url);
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

execBrief.get('/api/dev/exec-brief.html', async (_req, res) => {
  try {
    // Aggregate all data
    const status = await fetchJson('/dev/status');
    const checklist = await fetchJson('/dev/checklist');
    const compliance = await fetchJson('/api/compliance/snapshot');
    const coverage = await fetchJson('/api/compacts/coverage');
    const recent = await fetchJson('/api/verify/recent?n=10');

    // Generate HTML
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VitalCV Executive Brief</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 24px;
      max-width: 1200px;
      line-height: 1.6;
    }
    h1 {
      color: #1f2937;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    h2 {
      color: #374151;
      margin: 16px 0 8px 0;
      font-size: 18px;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      margin: 12px 0;
      background: #f9fafb;
    }
    pre {
      background: #1f2937;
      color: #f3f4f6;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
    }
    .footer {
      font-size: 12px;
      opacity: 0.7;
      margin-top: 32px;
      text-align: center;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }
  </style>
</head>
<body>
  <h1>VitalCV — Executive Brief</h1>

  <div class="grid">
    <div class="card">
      <h2>📊 Dev Status</h2>
      <pre>${JSON.stringify(status, null, 2)}</pre>
    </div>

    <div class="card">
      <h2>✅ Checklist</h2>
      <pre>${JSON.stringify(checklist, null, 2)}</pre>
    </div>
  </div>

  <div class="card">
    <h2>🏥 Compliance Snapshot (NCQA/JC)</h2>
    <pre>${JSON.stringify(compliance, null, 2)}</pre>
  </div>

  <div class="card">
    <h2>🗺️ Compact Coverage</h2>
    <pre>${JSON.stringify(coverage, null, 2)}</pre>
  </div>

  <div class="card">
    <h2>🔍 Recent Verifications</h2>
    <pre>${JSON.stringify(recent, null, 2)}</pre>
  </div>

  <div class="footer">
    Generated: ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

    res.type('text/html').send(html);
  } catch (error) {
    console.error('Exec brief HTML error:', error);
    res.status(500).json({ ok: false, error: 'Failed to generate exec brief' });
  }
});

execBrief.get('/api/dev/exec-brief.pdf', async (_req, res) => {
  try {
    // Dynamic import of puppeteer (will be installed separately)
    const puppeteer = await import('puppeteer');

    const url = `http://localhost:${process.env.PORT || 3001}/api/dev/exec-brief.html`;

    const browser = await puppeteer.default.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      printBackground: true,
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    res.type('application/pdf').send(pdf);
  } catch (error) {
    console.error('Exec brief PDF error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to generate PDF. Please ensure puppeteer is installed: pnpm add puppeteer'
    });
  }
});

