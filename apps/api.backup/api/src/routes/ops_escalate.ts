import { Router } from 'express';
import fetch from 'node-fetch';

export const escalate = Router();

escalate.post('/api/ops/escalate', async (req, res) => {
  const { title, body, labels = [], repo = 'yourorg/yourrepo' } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: 'missing title' });

  const tok = process.env.GH_TOKEN;
  if (!tok) {
    return res.json({
      ok: false,
      hint: "Set GH_TOKEN. Or run:",
      curl: `curl -H 'Authorization: token <GH_TOKEN>' -d '{"title":"${title}","body":"${(body || '').replace(/"/g, '\\"')}","labels":${JSON.stringify(labels)}}' https://api.github.com/repos/${repo}/issues`,
    });
  }

  const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${tok}`,
    },
    body: JSON.stringify({ title, body, labels }),
  });
  const js = await r.json();
  res.status(r.status).json(js);
});
