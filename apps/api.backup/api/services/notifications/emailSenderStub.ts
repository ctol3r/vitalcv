/**
 * B148A-NOTIF-009: Demo Email Sender Stub
 *
 * Background job that processes PENDING emails from the queue.
 * Logs to console instead of actually sending via SMTP.
 */

import { PrismaClient } from '@prisma/client';
import { EmailDeliveryStatus } from './models/EmailDelivery.js';
import { getServiceLogger } from '../logging/serviceLogger';
import { serializeError } from '@chai-vc/logging-core';

const prisma = new PrismaClient();
const log = getServiceLogger('notifications/emailSenderStub');

/**
 * Process pending email deliveries
 *
 * Loads PENDING EmailDelivery rows, logs 'would send' messages,
 * and marks status as SENT.
 *
 * This is a stub implementation - in production, this would
 * actually send emails via SMTP.
 */
export async function processPendingEmails(
  batchSize: number = 10
): Promise<{ processed: number; failed: number }> {
  // Load PENDING email deliveries
  const pendingEmails = await prisma.emailDelivery.findMany({
    where: {
      status: EmailDeliveryStatus.PENDING,
    },
    take: batchSize,
    orderBy: {
      createdAt: 'asc', // Process oldest first
    },
  });

  if (pendingEmails.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const email of pendingEmails) {
    try {
      // Stub: Log instead of sending
      log.info('Email sender stub would send email', {
        to: email.to,
        subject: email.subject,
        templateId: email.templateId || 'none',
        payload: email.payload,
      });

      // Mark as SENT
      await prisma.emailDelivery.update({
        where: { id: email.id },
        data: {
          status: EmailDeliveryStatus.SENT,
          sentAt: new Date(),
        },
      });

      processed++;
    } catch (error) {
      log.error('Failed to process email', {
        emailId: email.id,
        error: serializeError(error),
      });

      // Mark as FAILED
      await prisma.emailDelivery.update({
        where: { id: email.id },
        data: {
          status: EmailDeliveryStatus.FAILED,
          lastError:
            error instanceof Error ? error.message : 'Unknown error',
        },
      });

      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Run email sender job (can be called from a cron job or queue worker)
 */
export async function runEmailSenderJob(): Promise<void> {
  log.info('Starting email sender job');
  const result = await processPendingEmails(10);
  log.info('Email sender job complete', result);
}

