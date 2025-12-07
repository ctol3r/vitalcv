import { Router } from 'express';

export const devEnv = Router();

function redact(v?: string) {
  if (!v) return '';
  if (v.length <= 6) return '***';
  return v.slice(0, 3) + '***' + v.slice(-2);
}

devEnv.get('/dev/env', (_req, res) => {
  const out: any = {};

  for (const [k, v] of Object.entries(process.env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD|PRIVATE/i.test(k)) {
      out[k] = redact(String(v));
    } else if (/^NEXT_PUBLIC_/i.test(k)) {
      out[k] = v;
    }
  }

  res.json({ ok: true, env: out });
});

