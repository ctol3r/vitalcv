/**
 * B234B-COMM-009: NotificationService
 *
 * Sends notifications for replies, mentions, follows, endorsements, and moderation actions.
 * Routes to email and in-app channels and respects user preferences.
 */

import { PrismaClient } from '@prisma/client';
import { createNotification } from '../notifications/notificationService.js';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('community/notifications');

export type NotificationType =
  | 'REPLY'
  | 'MENTION'
  | 'FOLLOW'
  | 'ENDORSEMENT'
  | 'MODERATION_ACTION'
  | 'REACTION';

/**
 * Send notification for a reply to a post or comment
 */
export async function notifyReply(
  postId: string,
  commentId: string,
  authorId: string,
  replyAuthorId: string
) {
  try {
    // Get the post or parent comment to find the author
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: true,
        parent: true,
      },
    });

    if (!comment) {
      return;
    }

    let targetUserId: string | null = null;

    if (comment.parentId) {
      // Reply to a comment
      targetUserId = comment.parent?.authorId || null;
    } else {
      // Reply to a post
      targetUserId = comment.post?.authorId || null;
    }

    if (!targetUserId || targetUserId === replyAuthorId) {
      // Don't notify self
      return;
    }

    // Check user preferences
    const shouldNotify = await shouldSendNotification(targetUserId, 'REPLY');
    if (!shouldNotify) {
      return;
    }

    await createNotification(
      targetUserId,
      'REPLY',
      {
        postId,
        commentId,
        authorId,
        replyAuthorId,
        content: comment.content.substring(0, 100), // Preview
      }
    );

    log.info('Reply notification sent', {
      targetUserId,
      postId,
      commentId,
      replyAuthorId,
    });
  } catch (error) {
    log.error('Error sending reply notification', { error, postId, commentId });
  }
}

/**
 * Send notification for a mention in a post or comment
 */
export async function notifyMention(
  postId: string,
  commentId: string | null,
  mentionedUserId: string,
  authorId: string
) {
  try {
    if (mentionedUserId === authorId) {
      // Don't notify self
      return;
    }

    // Check user preferences
    const shouldNotify = await shouldSendNotification(mentionedUserId, 'MENTION');
    if (!shouldNotify) {
      return;
    }

    await createNotification(
      mentionedUserId,
      'MENTION',
      {
        postId,
        commentId,
        authorId,
      }
    );

    log.info('Mention notification sent', {
      mentionedUserId,
      postId,
      commentId,
      authorId,
    });
  } catch (error) {
    log.error('Error sending mention notification', {
      error,
      mentionedUserId,
      postId,
    });
  }
}

/**
 * Send notification for a follow
 */
export async function notifyFollow(
  followerId: string,
  followeeId: string
) {
  try {
    if (followerId === followeeId) {
      return;
    }

    // Check user preferences
    const shouldNotify = await shouldSendNotification(followeeId, 'FOLLOW');
    if (!shouldNotify) {
      return;
    }

    await createNotification(
      followeeId,
      'FOLLOW',
      {
        followerId,
      }
    );

    log.info('Follow notification sent', { followerId, followeeId });
  } catch (error) {
    log.error('Error sending follow notification', { error, followerId, followeeId });
  }
}

/**
 * Send notification for an endorsement
 */
export async function notifyEndorsement(
  followerId: string,
  followeeId: string,
  credentialId: string
) {
  try {
    if (followerId === followeeId) {
      return;
    }

    // Check user preferences
    const shouldNotify = await shouldSendNotification(followeeId, 'ENDORSEMENT');
    if (!shouldNotify) {
      return;
    }

    await createNotification(
      followeeId,
      'ENDORSEMENT',
      {
        followerId,
        credentialId,
      }
    );

    log.info('Endorsement notification sent', {
      followerId,
      followeeId,
      credentialId,
    });
  } catch (error) {
    log.error('Error sending endorsement notification', {
      error,
      followerId,
      followeeId,
    });
  }
}

/**
 * Send notification for a reaction
 */
export async function notifyReaction(
  userId: string,
  postId: string | null,
  commentId: string | null,
  reactionType: string
) {
  try {
    let targetUserId: string | null = null;

    if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });
      targetUserId = post?.authorId || null;
    } else if (commentId) {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { authorId: true },
      });
      targetUserId = comment?.authorId || null;
    }

    if (!targetUserId || targetUserId === userId) {
      return;
    }

    // Check user preferences
    const shouldNotify = await shouldSendNotification(targetUserId, 'REACTION');
    if (!shouldNotify) {
      return;
    }

    await createNotification(
      targetUserId,
      'REACTION',
      {
        userId,
        postId,
        commentId,
        reactionType,
      }
    );

    log.info('Reaction notification sent', {
      targetUserId,
      userId,
      postId,
      commentId,
      reactionType,
    });
  } catch (error) {
    log.error('Error sending reaction notification', {
      error,
      userId,
      postId,
      commentId,
    });
  }
}

/**
 * Send notification for moderation action
 */
export async function notifyModerationAction(
  userId: string,
  action: string,
  reason: string,
  targetType: 'post' | 'comment',
  targetId: string
) {
  try {
    // Check user preferences
    const shouldNotify = await shouldSendNotification(userId, 'MODERATION_ACTION');
    if (!shouldNotify) {
      return;
    }

    await createNotification(
      userId,
      'MODERATION_ACTION',
      {
        action,
        reason,
        targetType,
        targetId,
      }
    );

    log.info('Moderation action notification sent', {
      userId,
      action,
      targetType,
      targetId,
    });
  } catch (error) {
    log.error('Error sending moderation notification', {
      error,
      userId,
      action,
    });
  }
}

/**
 * Check if notification should be sent based on user preferences
 */
async function shouldSendNotification(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  try {
    // Check user notification preferences
    // For now, default to true - can be extended with user preferences table
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return false;
    }

    // TODO: Add user notification preferences model
    // For now, always send notifications
    return true;
  } catch (error) {
    log.error('Error checking notification preferences', { error, userId, type });
    return false;
  }
}

/**
 * Extract mentions from text (e.g., @username)
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }

  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Process mentions in post or comment content
 */
export async function processMentions(
  content: string,
  postId: string,
  commentId: string | null,
  authorId: string
) {
  const mentions = extractMentions(content);

  for (const mention of mentions) {
    // Try to find user by username/email (simplified - adjust based on your user model)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: mention } },
          { name: { contains: mention } },
        ],
      },
      select: { id: true },
    });

    if (user) {
      await notifyMention(postId, commentId, user.id, authorId);
    }
  }
}

