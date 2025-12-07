import { Router } from 'express';
import fs from 'fs';
import fetch from 'node-fetch';

export const execDiff = Router();

function read(p: string) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

execDiff.get('/api/dev/exec-brief/snapshot', async (_req, res) => {
  const r = await fetch(
    'http://localhost:' + (process.env.PORT || 4000) + '/api/dev/share-report.json'
  );
  const cur = await r.json();
  try {
    const last = read('exec_brief_last.json');
    if (last) {
      fs.writeFileSync('exec_brief_prev.json', JSON.stringify(last));
    }
    fs.writeFileSync('exec_brief_last.json', JSON.stringify(cur));
  } catch {}
  res.json({ ok: true, saved: true });
});

execDiff.get('/api/dev/exec-brief/diff', async (_req, res) => {
  const A = read('exec_brief_prev.json') || {};
  const B = read('exec_brief_last.json') || {};
  function keys(o: any) {
    return Object.keys(o || {});
  }
  const added = keys(B).filter((k) => !(k in A));
  const removed = keys(A).filter((k) => !(k in B));
  const changed = keys(B).filter(
    (k) => k in A && JSON.stringify(A[k]) !== JSON.stringify(B[k])
  );
  res.json({
    ok: true,
    counts: { added: added.length, removed: removed.length, changed: changed.length },
    added,
    removed,
    changed,
  });
});

execDiff.get('/api/dev/exec-brief/diff.html', async (_req, res) => {
  const r = await fetch(
    'http://localhost:' + (process.env.PORT || 4000) + '/api/dev/exec-brief/diff'
  );
  const js = await r.json();
  const html = `<!doctype html><meta charset='utf-8'><title>Exec Brief Diff</title><style>body{font-family:system-ui;margin:24px} .card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:8px 0}</style><h1>Exec Brief Diff</h1><div class='card'><h2>Counts</h2><pre>${JSON.stringify(
    js.counts,
    null,
    2
  )}</pre></div><div class='card'><h2>Added</h2><pre>${JSON.stringify(
    js.added,
    null,
    2
  )}</pre></div><div class='card'><h2>Removed</h2><pre>${JSON.stringify(
    js.removed,
    null,
    2
  )}</pre></div><div class='card'><h2>Changed</h2><pre>${JSON.stringify(
    js.changed,
    null,
    2
  )}</pre></div>`;
  res.type('text/html').send(html);
});











