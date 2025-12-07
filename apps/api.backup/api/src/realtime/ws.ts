import { WebSocketServer } from 'ws';
import { pool } from '../db';

export function createWSS(server: any) {
  const wss = new WebSocketServer({ server });

  // Store globally so we can broadcast from workers
  (global as any).__wss = wss;

  wss.on('connection', async (ws) => {
    // Bootstrap new connections with last 20 verification events
    try {
      const { rows } = await pool.query(
        'SELECT ts, request, result FROM "VerifyResultLog" ORDER BY ts DESC LIMIT 20'
      );
      ws.send(JSON.stringify({
        type: 'bootstrap',
        rows: rows.reverse()
      }));
    } catch (err) {
      console.error('Failed to bootstrap WS client:', err);
    }

    // Broadcast updated presence count
    broadcastPresence();

    ws.on('close', () => {
      broadcastPresence();
    });

    ws.on('error', (err) => {
      console.error('WS error:', err);
    });
  });

  function broadcastPresence() {
    const n = wss.clients.size;
    wss.clients.forEach((c: any) => {
      try {
        if (c.readyState === 1) { // OPEN
          c.send(JSON.stringify({ type: 'presence', value: n }));
        }
      } catch (err) {
        console.error('Failed to send presence:', err);
      }
    });
  }

  return wss;
}

/**
 * Broadcast verification event to all connected WebSocket clients
 */
export function wsBroadcastVerify(row: any) {
  try {
    const wss: any = (global as any).__wss;
    if (!wss) return;

    const message = JSON.stringify({ type: 'verify', row });

    wss.clients.forEach((c: any) => {
      try {
        if (c.readyState === 1) { // OPEN
          c.send(message);
        }
      } catch (err) {
        console.error('Failed to broadcast verify:', err);
      }
    });
  } catch (err) {
    console.error('Failed to broadcast verification:', err);
  }
}

