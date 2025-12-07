import { Router } from 'express';
import { pool } from '../../../src/db';
import { streamsGate } from '../../../src/middleware/streams_gate';

export const verifySSE = Router();

const clients = new Set<any>();

verifySSE.get('/api/verify/stream', streamsGate, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  clients.add(res);

  const send = (type: string, data: any) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send last 20 verification events for context on connect
  try {
    const { rows } = await pool.query(
      'SELECT ts, request, result FROM "VerifyResultLog" ORDER BY ts DESC LIMIT 20'
    );
    send('bootstrap', rows.reverse());
  } catch (err) {
    console.error('Failed to bootstrap verify stream:', err);
  }

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: hb ${Date.now()}\n\n`);
    } catch (err) {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

/**
 * Notifier helper - call this after writing new VerifyResultLog entries
 * to push updates to all connected SSE clients
 */
export async function notifyVerify() {
  try {
    const { rows } = await pool.query(
      'SELECT ts, request, result FROM "VerifyResultLog" ORDER BY ts DESC LIMIT 1'
    );

    if (rows.length === 0) return;

    const event = `event: verify\ndata: ${JSON.stringify(rows[0])}\n\n`;

    for (const client of clients) {
      try {
        client.write(event);
      } catch (err) {
        // Client disconnected, remove silently
        clients.delete(client);
      }
    }
  } catch (err) {
    console.error('Failed to notify verify clients:', err);
  }
}

