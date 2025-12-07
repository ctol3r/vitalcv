/**
 * B234A-COMM-005: ModerationTools service
 *
 * Provides APIs for moderators to flag, hide, or delete posts/comments;
 * tracks reasons and moderator actions; supports appeals workflow.
 */

import { PrismaClient } from '@prisma/client';
import {
  ForumPost,
  softDeleteForumPost,
  restoreForumPost,
  lockForumPost,
  pinForumPost,
} from './models/ForumPost.js';
import {
  ForumComment,
  softDeleteForumComment,
  restoreForumComment,
} from './models/ForumComment.js';
import { getServiceLogger } from '../logging/serviceLogger.js';

const log = getServiceLogger('community/moderation');

export interface AuthContext {
  userId: string;
  roles: string[];
}

export type ModerationAction = 'flag' | 'hide' | 'delete' | 'lock' | 'pin' | 'unpin';
export type ModerationReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'misinformation'
  | 'copyright'
  | 'inappropriate_content'
  | 'off_topic'
  | 'other';

export interface ModerationRecord {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  action: ModerationAction;
  reason: ModerationReason;
  moderatorId: string;
  notes?: string;
  appealed: boolean;
  appealResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Check if user is a moderator
 */
function requireModerator(auth: AuthContext): void {
  const isModerator = auth.roles.some((role) => ['admin', 'moderator'].includes(role));
  if (!isModerator) {
    throw new Error('Access denied. Moderator role required.');
  }
}

/**
 * Record moderation action in database
 * Note: In production, this would use a ModerationRecord model in Prisma
 */
async function recordModerationAction(
  prisma: PrismaClient,
  targetType: 'post' | 'comment',
  targetId: string,
  action: ModerationAction,
  reason: ModerationReason,
  moderatorId: string,
  notes?: string
): Promise<void> {
  // In a real implementation, this would create a ModerationRecord
  // For now, we'll log it
  log.info('Moderation action recorded', {
    targetType,
    targetId,
    action,
    reason,
    moderatorId,
    notes,
  });

  // TODO: Create ModerationRecord model and persist to database
  // await prisma.moderationRecord.create({
  //   data: {
  //     targetType,
  //     targetId,
  //     action,
  //     reason,
  //     moderatorId,
  //     notes,
  //     appealed: false,
  //     appealResolved: false,
  //   },
  // });
}

/**
 * Flag a post or comment
 */
export async function flagContent(
  prisma: PrismaClient,
  targetType: 'post' | 'comment',
  targetId: string,
  reason: ModerationReason,
  notes?: string,
  auth?: AuthContext
): Promise<void> {
  // Anyone can flag content, but we track who flagged it
  const flaggedBy = auth?.userId || 'anonymous';

  log.info('Content flagged', {
    targetType,
    targetId,
    reason,
    flaggedBy,
    notes,
  });

  // Record the flag
  await recordModerationAction(
    prisma,
    targetType,
    targetId,
    'flag',
    reason,
    flaggedBy,
    notes
  );

  // In production, you might want to:
  // - Send notification to moderators
  // - Auto-hide if multiple flags
  // - Add to moderation queue
}

/**
 * Hide a post (soft delete, visible only to moderators)
 */
export async function hidePost(
  prisma: PrismaClient,
  postId: string,
  reason: ModerationReason,
  notes: string,
  auth: AuthContext
): Promise<ForumPost> {
  requireModerator(auth);
  log.info('Hiding forum post', { postId, reason, moderatorId: auth.userId, notes });

  await recordModerationAction(prisma, 'post', postId, 'hide', reason, auth.userId, notes);
  return softDeleteForumPost(prisma, postId);
}

/**
 * Hide a comment (soft delete, visible only to moderators)
 */
export async function hideComment(
  prisma: PrismaClient,
  commentId: string,
  reason: ModerationReason,
  notes: string,
  auth: AuthContext
): Promise<ForumComment> {
  requireModerator(auth);
  log.info('Hiding forum comment', {
    commentId,
    reason,
    moderatorId: auth.userId,
    notes,
  });

  await recordModerationAction(
    prisma,
    'comment',
    commentId,
    'hide',
    reason,
    auth.userId,
    notes
  );
  return softDeleteForumComment(prisma, commentId);
}

/**
 * Delete a post permanently (hard delete - use with caution)
 */
export async function deletePostPermanently(
  prisma: PrismaClient,
  postId: string,
  reason: ModerationReason,
  notes: string,
  auth: AuthContext
): Promise<void> {
  requireModerator(auth);
  log.warn('Permanently deleting forum post', {
    postId,
    reason,
    moderatorId: auth.userId,
    notes,
  });

  await recordModerationAction(prisma, 'post', postId, 'delete', reason, auth.userId, notes);

  // Hard delete (remove from database)
  await prisma.forumPost.delete({
    where: { id: postId },
  });
}

/**
 * Delete a comment permanently (hard delete - use with caution)
 */
export async function deleteCommentPermanently(
  prisma: PrismaClient,
  commentId: string,
  reason: ModerationReason,
  notes: string,
  auth: AuthContext
): Promise<void> {
  requireModerator(auth);
  log.warn('Permanently deleting forum comment', {
    commentId,
    reason,
    moderatorId: auth.userId,
    notes,
  });

  await recordModerationAction(
    prisma,
    'comment',
    commentId,
    'delete',
    reason,
    auth.userId,
    notes
  );

  // Hard delete (remove from database)
  await prisma.forumComment.delete({
    where: { id: commentId },
  });
}

/**
 * Lock a post (prevents new comments)
 */
export async function lockPost(
  prisma: PrismaClient,
  postId: string,
  reason: ModerationReason,
  notes: string,
  auth: AuthContext
): Promise<ForumPost> {
  requireModerator(auth);
  log.info('Locking forum post', { postId, reason, moderatorId: auth.userId, notes });

  await recordModerationAction(prisma, 'post', postId, 'lock', reason, auth.userId, notes);
  return lockForumPost(prisma, postId);
}

/**
 * Pin a post
 */
export async function pinPost(
  prisma: PrismaClient,
  postId: string,
  reason: ModerationReason,
  notes: string,
  auth: AuthContext
): Promise<ForumPost> {
  requireModerator(auth);
  log.info('Pinning forum post', { postId, reason, moderatorId: auth.userId, notes });

  await recordModerationAction(prisma, 'post', postId, 'pin', reason, auth.userId, notes);
  return pinForumPost(prisma, postId);
}

/**
 * Restore a hidden post
 */
export async function restorePost(
  prisma: PrismaClient,
  postId: string,
  notes: string,
  auth: AuthContext
): Promise<ForumPost> {
  requireModerator(auth);
  log.info('Restoring forum post', { postId, moderatorId: auth.userId, notes });

  // Record restoration action
  await recordModerationAction(
    prisma,
    'post',
    postId,
    'flag', // Using 'flag' as a generic action type for restoration
    'other',
    auth.userId,
    `Restored: ${notes}`
  );

  return restoreForumPost(prisma, postId);
}

/**
 * Restore a hidden comment
 */
export async function restoreComment(
  prisma: PrismaClient,
  commentId: string,
  notes: string,
  auth: AuthContext
): Promise<ForumComment> {
  requireModerator(auth);
  log.info('Restoring forum comment', { commentId, moderatorId: auth.userId, notes });

  // Record restoration action
  await recordModerationAction(
    prisma,
    'comment',
    commentId,
    'flag', // Using 'flag' as a generic action type for restoration
    'other',
    auth.userId,
    `Restored: ${notes}`
  );

  return restoreForumComment(prisma, commentId);
}

/**
 * Submit an appeal for moderated content
 */
export async function submitAppeal(
  prisma: PrismaClient,
  targetType: 'post' | 'comment',
  targetId: string,
  appealReason: string,
  auth: AuthContext
): Promise<void> {
  log.info('Appeal submitted', {
    targetType,
    targetId,
    appealReason,
    userId: auth.userId,
  });

  // TODO: Create Appeal model and persist to database
  // await prisma.appeal.create({
  //   data: {
  //     targetType,
  //     targetId,
  //     appealReason,
  //     submittedBy: auth.userId,
  //     status: 'pending',
  //   },
  // });

  // In production, you would:
  // - Create an Appeal record
  // - Link it to the ModerationRecord
  // - Notify moderators
  // - Track appeal status
}

/**
 * Resolve an appeal
 */
export async function resolveAppeal(
  prisma: PrismaClient,
  appealId: string,
  approved: boolean,
  resolutionNotes: string,
  auth: AuthContext
): Promise<void> {
  requireModerator(auth);
  log.info('Appeal resolved', {
    appealId,
    approved,
    resolutionNotes,
    moderatorId: auth.userId,
  });

  // TODO: Update Appeal model
  // await prisma.appeal.update({
  //   where: { id: appealId },
  //   data: {
  //     status: approved ? 'approved' : 'rejected',
  //     resolvedBy: auth.userId,
  //     resolvedAt: new Date(),
  //     resolutionNotes,
  //   },
  // });

  // If approved, restore the content
  // const appeal = await prisma.appeal.findUnique({ where: { id: appealId } });
  // if (approved && appeal) {
  //   if (appeal.targetType === 'post') {
  //     await restorePost(prisma, appeal.targetId, resolutionNotes, auth);
  //   } else {
  //     await restoreComment(prisma, appeal.targetId, resolutionNotes, auth);
  //   }
  // }
}

/**
 * Get moderation history for a post or comment
 */
export async function getModerationHistory(
  prisma: PrismaClient,
  targetType: 'post' | 'comment',
  targetId: string,
  auth: AuthContext
): Promise<ModerationRecord[]> {
  requireModerator(auth);

  // TODO: Query ModerationRecord model
  // return prisma.moderationRecord.findMany({
  //   where: {
  //     targetType,
  //     targetId,
  //   },
  //   orderBy: { createdAt: 'desc' },
  // });

  // For now, return empty array
  log.info('Fetching moderation history', { targetType, targetId });
  return [];
}

