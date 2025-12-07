/**
 * B148A-NOTIF-002: Notification Service
 * B149B-FF-013: Guard notifications subsystem with `notifications.enabled` flag
 *
 * Service for creating notifications and marking them as read.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  CreateNotificationInput,
  CreateNotificationSchema,
} from './models/Notification.js';
import { checkFeatureFlag } from '../flags/featureFlags.js';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('notifications/service');

/**
 * B149B-FF-013: Create a new notification
 * If notifications.enabled is false, this is a no-op (logs info, returns null)
 */
export async function createNotification(
  userId: string,
  type: string,
  payload: any
) {
  // Check if notifications feature is enabled
  const enabled = await checkFeatureFlag(prisma, 'notifications.enabled');
  if (!enabled) {
    log.info('Notifications disabled, skipping notification creation', {
      userId,
      type,
    });
    return null;
  }

  const input: CreateNotificationInput = { userId, type, payload };
  const validation = CreateNotificationSchema.safeParse(input);

  if (!validation.success) {
    throw new Error(`Invalid notification input: ${validation.error.message}`);
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      payload: payload as Prisma.InputJsonValue,
      read: false,
    },
  });

  return notification;
}

/**
 * Mark a notification as read
 */
export async function markRead(id: string, userId: string) {
  // First verify the notification exists and belongs to the user
  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!notification) {
    throw new Error('Notification not found or not owned by user');
  }

  // If already read, return early
  if (notification.read) {
    return notification;
  }

  // Mark as read
  const updated = await prisma.notification.update({
    where: { id },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return updated;
}

/**
 * List notifications for a user
 */
export async function listNotifications(
  userId: string,
  options?: {
    onlyUnread?: boolean;
    limit?: number;
  }
) {
  const limit = Math.min(options?.limit || 50, 100);
  const onlyUnread = options?.onlyUnread || false;

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(onlyUnread ? { read: false } : {}),
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: [
      { read: 'asc' }, // Unread first (false comes before true)
      { createdAt: 'desc' }, // Then by creation date
    ],
    take: limit,
  });

  return notifications;
}

