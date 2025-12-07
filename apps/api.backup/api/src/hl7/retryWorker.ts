
import { PrismaClient } from '@prisma/client';
import { parseHL7 } from './parser';

const prisma = new PrismaClient();

export function startRetryWorker() {
  // Run every 60s
  setInterval(async () => {
    console.log('[HL7 Worker] Starting retry cycle...');
    try {
      // Find errored messages
      // Limit to 50 to avoid clogging
      const erroredMessages = await prisma.hL7Message.findMany({
        where: { status: 'errored' },
        take: 50,
        orderBy: { createdAt: 'asc' } // Retry oldest first
      });

      if (erroredMessages.length === 0) {
        return;
      }

      console.log(`[HL7 Worker] Found ${erroredMessages.length} errored messages to retry.`);

      for (const msg of erroredMessages) {
        try {
          const { status, parsedData, error } = parseHL7(msg.raw);

          if (status === 'parsed') {
             await prisma.hL7Message.update({
               where: { id: msg.id },
               data: {
                 status: 'parsed',
                 parsed: parsedData ?? undefined
               }
             });
             console.log(`[HL7 Worker] Successfully re-parsed message ${msg.id}`);

             // Log to PilotMetricEvent (placeholder)
             // await prisma.pilotMetricEvent.create({ ... });

          } else {
             // Still errored.
             // We could update the 'parsed' field with the new error if we had an error field,
             // but currently we just leave it as 'errored'.
             // To avoid infinite retries of the same message every minute,
             // in a real system we would increment a retry counter.
             // For this MVP/task, we follow instructions: "mark success or leave errored".
          }
        } catch (innerErr) {
          console.error(`[HL7 Worker] Exception reprocessing message ${msg.id}`, innerErr);
        }
      }
    } catch (e) {
      console.error('[HL7 Worker] Global error in retry loop', e);
    }
  }, 60000);
}














