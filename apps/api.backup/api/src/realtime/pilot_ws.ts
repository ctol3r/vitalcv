import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';

export function createPilotWSS(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws/pilot-health' });
  let last: any = null;

  async function pull() {
    try {
      const port = process.env.PORT || 4000;
      const r = await fetch(`http://localhost:${port}/api/pilot/health`);
      const js = await r.json();

      // Broadcast health update to all clients
      wss.clients.forEach((c) => {
        try {
          c.send(JSON.stringify({ type: 'health', payload: js }));
        } catch {}
      });

      // Check for delta in PSV score or wallet stats
      if (last && JSON.stringify(last.psv_score) !== JSON.stringify(js.psv_score)) {
        wss.clients.forEach((c) => {
          try {
            c.send(
              JSON.stringify({
                type: 'delta',
                field: 'psv_score',
                from: last.psv_score,
                to: js.psv_score,
              })
            );
          } catch {}
        });
      }

      if (last && JSON.stringify(last.wallet) !== JSON.stringify(js.wallet)) {
        wss.clients.forEach((c) => {
          try {
            c.send(
              JSON.stringify({
                type: 'delta',
                field: 'wallet',
                from: last.wallet,
                to: js.wallet,
              })
            );
          } catch {}
        });
      }

      last = js;
    } catch (e) {
      console.error('Pilot WS pull error:', e);
    }
  }

  // Pull every 15 seconds
  setInterval(pull, 15000);
  // Initial pull
  pull();

  return wss;
}

