/**
 * B148A-NOTIF-003/004: Notification API Routes
 *
 * Combined router for notification endpoints:
 * - GET /me/notifications - List notifications
 * - POST /me/notifications/:id/read - Mark as read
 */

import { Router, Request, Response } from 'express';
import { listNotifications, markRead } from '../../../../../services/notifications/notificationService.js';
import { serializeNotification } from '../../../../../services/notifications/models/Notification.js';

const router = Router();

/**
 * GET /me/notifications
 * List current user's notifications (unread first)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get userId from authenticated request (assuming it's set by auth middleware)
    const userId = (req as any).user?.id || (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID required',
      });
    }

    // Parse query parameters
    const onlyUnread = req.query.onlyUnread === 'true';
    const limit = req.query.limit
      ? Math.min(parseInt(req.query.limit as string, 10), 100)
      : 50;

    // Fetch notifications
    const notifications = await listNotifications(userId, {
      onlyUnread,
      limit,
    });

    return res.json({
      success: true,
      data: notifications.map(serializeNotification),
      count: notifications.length,
    });
  } catch (error) {
    console.error('Error listing notifications:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to list notifications',
    });
  }
});

/**
 * POST /me/notifications/:id/read
 * Mark a notification as read
 */
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    // Get userId from authenticated request
    const userId = (req as any).user?.id || (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID required',
      });
    }

    const { id } = req.params;

    try {
      // Mark notification as read
      const notification = await markRead(id, userId);

      return res.json({
        success: true,
        data: serializeNotification(notification),
        message: 'Notification marked as read',
      });
    } catch (error) {
      // Check if it's a "not found" error
      if (
        error instanceof Error &&
        error.message.includes('not found')
      ) {
        return res.status(404).json({
          error: 'NotFound',
          message: error.message,
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to mark notification as read',
    });
  }
});

export default router;

