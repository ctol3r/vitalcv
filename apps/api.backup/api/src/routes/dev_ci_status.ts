import { Router } from 'express';
import fetch from 'node-fetch';

export const devCiStatus = Router();

devCiStatus.get('/dev/ci/status', async (_req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const be = process.env.GITHUB_REPO_BACKEND;
    const fe = process.env.GITHUB_REPO_FRONTEND;
    const sha = process.env.GIT_SHA;

    if (!token || !be || !fe || !sha) {
      return res.json({ ok: false, note: 'missing env' });
    }

    const hdr: any = {
      Authorization: `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    };

    const gb = await (await fetch(`https://api.github.com/repos/${be}/commits/${sha}/status`, { headers: hdr })).json();
    const gf = await (await fetch(`https://api.github.com/repos/${fe}/commits/${sha}/status`, { headers: hdr })).json();

    res.json({ ok: true, backend: (gb as any)?.state, frontend: (gf as any)?.state });
  } catch (e: any) {
    res.json({ ok: false, error: String(e?.message || e) });
  }
});

