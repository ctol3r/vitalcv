import { consumer, producer } from '../libs/bus/kafka';
import { computeAuthzV3 } from '../services/telehealth_authz';
import { pool } from '../db';
import { notifyVerify } from '../../backend/src/routes/verify_sse';
import { wsBroadcastVerify } from '../realtime/ws';

export async function startVerifyWorker() {
  await consumer.subscribe({ topic: 'work.verify.request', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const m = JSON.parse((message.value || '{}').toString());
        const out = await computeAuthzV3({
          patient: m.patient || 'CA',
          npi: m.npi,
          profession: m.profession || 'physician',
          mode: m.mode || 'tele'
        } as any);

        await producer.send({
          topic: 'work.verify.result',
          messages: [{
            value: JSON.stringify({
              ts: Date.now(),
              request: m,
              result: out
            })
          }]
        });

        // Write to VerifyResultLog for admin stream
        await pool.query(
          'INSERT INTO "VerifyResultLog"(request,result) VALUES($1,$2)',
          [m, out]
        );

        // Notify SSE clients of new verification event
        await notifyVerify();

        // Broadcast to WebSocket clients
        wsBroadcastVerify({
          ts: new Date().toISOString(),
          request: m,
          result: out
        });
      } catch (e) {
        console.error('Verify worker error:', e);
        // TODO: DLQ
      }
    }
  });
}

