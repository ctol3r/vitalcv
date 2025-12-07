import { Router } from 'express';
import fetch from 'node-fetch';

export const share = Router();

async function j(u: string) {
  try {
    const r = await fetch('http://localhost:' + (process.env.PORT || 4000) + u);
    return await r.json();
  } catch {
    return null;
  }
}

share.get('/api/dev/share-report.json', async (_req, res) => {
  const status = await j('/dev/status');
  const checklist = await j('/dev/checklist');
  const heatmap = await j('/api/digests/heatmap');

  res.json({
    generated_at: new Date().toISOString(),
    status,
    checklist,
    heatmap
  });
});

share.get('/api/dev/share-report.html', async (_req, res) => {
  const r = await fetch('http://localhost:' + (process.env.PORT || 4000) + '/api/dev/share-report.json');
  const js: any = await r.json();

  const html = `<!doctype html>
<meta charset='utf-8'>
<title>VitalCV Share Preview</title>
<style>
  body { font-family: system-ui; margin: 24px; }
  .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin: 8px 0; }
</style>
<h1>VitalCV — Share Preview</h1>
<div class='card'>
  <h3>Status</h3>
  <pre>${JSON.stringify(js.status, null, 2)}</pre>
</div>
<div class='card'>
  <h3>Checklist</h3>
  <pre>${JSON.stringify(js.checklist, null, 2)}</pre>
</div>
<div class='card'>
  <h3>Heatmap</h3>
  <pre>${JSON.stringify(js.heatmap, null, 2)}</pre>
</div>
<div class='card' style='font-size:12px;opacity:.7'>
  Generated ${new Date().toLocaleString()}
</div>`;

  res.type('text/html').send(html);
});

