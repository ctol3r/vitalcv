import { Router, Request, Response } from 'express';

export const alertsSSE = Router();

const clients = new Set<Response>();

alertsSSE.get('/api/alerts/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  clients.add(res);

  // Heartbeat every 15 seconds
  const hb = setInterval(() => {
    try {
      res.write(`:hb ${Date.now()}\n\n`);
    } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(hb);
    clients.delete(res);
  });
});

export async function pushAlert(msg: any) {
  for (const c of clients) {
    try {
      c.write(`event: alert\n`);
      c.write(`data: ${JSON.stringify(msg)}\n\n`);
    } catch {}
  }
}

