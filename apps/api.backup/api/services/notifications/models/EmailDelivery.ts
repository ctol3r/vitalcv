/**
 * B148A-NOTIF-005: EmailDelivery Model
 *
 * Model for email delivery queue tracking.
 */

import { z } from 'zod';

/**
 * Valid email delivery statuses
 */
export const EmailDeliveryStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;

export type EmailDeliveryStatusType =
  (typeof EmailDeliveryStatus)[keyof typeof EmailDeliveryStatus];

/**
 * Schema for enqueuing an email
 */
export const EnqueueEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  templateId: z.string().optional(),
  payload: z.any(), // Template payload/variables
});

export type EnqueueEmailInput = z.infer<typeof EnqueueEmailSchema>;

/**
 * Serialize email delivery for API response
 */
export function serializeEmailDelivery(emailDelivery: {
  id: string;
  to: string;
  subject: string;
  templateId: string | null;
  payload: any;
  status: string;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
}) {
  return {
    id: emailDelivery.id,
    to: emailDelivery.to,
    subject: emailDelivery.subject,
    templateId: emailDelivery.templateId,
    payload: emailDelivery.payload,
    status: emailDelivery.status,
    lastError: emailDelivery.lastError,
    createdAt: emailDelivery.createdAt.toISOString(),
    sentAt: emailDelivery.sentAt?.toISOString() || null,
  };
}

