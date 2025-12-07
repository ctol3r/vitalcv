/**
 * B148A-NOTIF-004: API: Mark notification as read
 *
 * POST /me/notifications/:id/read
 *
 * Sets readAt timestamp for the notification.
 * Returns 404 if notification not found or not owned by user.
 * Returns updated notification document.
 */

import { Router, Request, Response } from 'express';
import { markRead } from '../../../../../services/notifications/notificationService.js';
import { serializeNotification } from '../../../../../services/notifications/models/Notification.js';

const router = Router();

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

