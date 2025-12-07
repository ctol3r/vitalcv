/**
 * B148A-NOTIF-006: Email Enqueue Helper
 *
 * Helper for enqueuing emails to the delivery queue (no actual SMTP yet).
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  EnqueueEmailInput,
  EnqueueEmailSchema,
  EmailDeliveryStatus,
} from './models/EmailDelivery.js';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('notifications/emailEnqueue');

/**
 * Enqueue an email for delivery
 *
 * Inserts an EmailDelivery row with status=PENDING.
 * Does not actually send the email (that's handled by a background job).
 */
export async function enqueueEmail(
  to: string,
  templateId: string | undefined,
  payload: any
): Promise<{ id: string; subject: string }> {
  const subject = payload.subject || 'Notification';

  const input: EnqueueEmailInput = {
    to,
    subject,
    templateId,
    payload,
  };

  const validation = EnqueueEmailSchema.safeParse(input);

  if (!validation.success) {
    throw new Error(`Invalid email input: ${validation.error.message}`);
  }

  // Insert email delivery record
  const emailDelivery = await prisma.emailDelivery.create({
    data: {
      to,
      subject,
      templateId: templateId || null,
      payload: payload as Prisma.InputJsonValue,
      status: EmailDeliveryStatus.PENDING,
    },
  });

  // Log stub (no actual SMTP yet)
  log.info('Queued email for delivery', {
    to,
    subject,
    templateId: templateId || 'none',
  });

  return {
    id: emailDelivery.id,
    subject: emailDelivery.subject,
  };
}

