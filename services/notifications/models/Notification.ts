/**
 * B148A-NOTIF-001: Notification Model
 *
 * Model for user notifications with type, payload, and read status tracking.
 */

import { z } from 'zod';

/**
 * Schema for creating a new Notification
 */
export const CreateNotificationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  orgId: z.string().optional(), // Optional organization ID
  type: z.string().min(1, 'Notification type is required'),
  payload: z.any(), // JSON payload
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

/**
 * Serialize notification for API response
 */
export function serializeNotification(notification: {
  id: string;
  userId: string;
  orgId: string | null;
  type: string;
  payload: any;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: notification.id,
    userId: notification.userId,
    orgId: notification.orgId,
    type: notification.type,
    payload: notification.payload,
    read: notification.read,
    readAt: notification.readAt?.toISOString() || null,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
  };
}

