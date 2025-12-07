import { Router } from 'express';
import { app } from '../server';

function getRoutes() {
  const out: any[] = [];
  const stack = (app as any)?._router?.stack || [];

  for (const layer of stack) {
    if (layer.route) {
      const r = layer.route;
      const methods = Object.keys(r.methods || {}).filter(k => r.methods[k]);
      out.push({ path: r.path, methods });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      for (const l2 of layer.handle.stack) {
        if (l2.route) {
          const r = l2.route;
          const methods = Object.keys(r.methods || {}).filter(k => r.methods[k]);
          out.push({ path: r.path, methods });
        }
      }
    }
  }

  // de-dupe
  const seen = new Set();
  return out.filter(r => {
    const k = r.methods.sort().join(',') + r.path;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const devRoutes = Router();

devRoutes.get('/dev/routes', (_req, res) => {
  res.json({ ok: true, routes: getRoutes() });
});

