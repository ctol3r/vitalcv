/**
 * B234B-COMM-008: ReactionService
 *
 * Allows liking, upvoting, and marking accepted answers on posts/comments.
 * Stores reaction counts and ensures one reaction per user per item.
 * Integrates with Reputation service.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('community/reactions');

export type ReactionType = 'like' | 'upvote' | 'accepted';

/**
 * Add a reaction to a post or comment
 */
export async function addReaction(
  userId: string,
  type: ReactionType,
  postId?: string,
  commentId?: string
) {
  if (!postId && !commentId) {
    throw new Error('Either postId or commentId must be provided');
  }

  if (postId && commentId) {
    throw new Error('Cannot react to both post and comment');
  }

  // Check if reaction already exists
  const existing = await prisma.reaction.findFirst({
    where: {
      userId,
      type,
      ...(postId ? { postId } : { commentId }),
    },
  });

  if (existing) {
    // Remove existing reaction (toggle off)
    await prisma.reaction.delete({
      where: { id: existing.id },
    });
    log.info('Reaction removed', { userId, type, postId, commentId });
    return { added: false, reaction: null };
  }

  // Create new reaction
  const reaction = await prisma.reaction.create({
    data: {
      userId,
      type,
      postId: postId || null,
      commentId: commentId || null,
    },
  });

  log.info('Reaction added', { userId, type, postId, commentId });

  // Update reputation if it's an upvote or accepted answer
  if (type === 'upvote' || type === 'accepted') {
    await updateReputationForReaction(reaction);
  }

  return { added: true, reaction };
}

/**
 * Remove a reaction
 */
export async function removeReaction(reactionId: string, userId: string) {
  const reaction = await prisma.reaction.findUnique({
    where: { id: reactionId },
  });

  if (!reaction) {
    throw new Error('Reaction not found');
  }

  if (reaction.userId !== userId) {
    throw new Error('Cannot remove reaction that does not belong to you');
  }

  await prisma.reaction.delete({
    where: { id: reactionId },
  });

  log.info('Reaction removed', { reactionId, userId });
  return { success: true };
}

/**
 * Get reaction counts for a post or comment
 */
export async function getReactionCounts(
  postId?: string,
  commentId?: string
): Promise<Record<ReactionType, number>> {
  if (!postId && !commentId) {
    throw new Error('Either postId or commentId must be provided');
  }

  const reactions = await prisma.reaction.findMany({
    where: {
      ...(postId ? { postId } : { commentId }),
    },
  });

  const counts: Record<ReactionType, number> = {
    like: 0,
    upvote: 0,
    accepted: 0,
  };

  for (const reaction of reactions) {
    if (reaction.type in counts) {
      counts[reaction.type as ReactionType]++;
    }
  }

  return counts;
}

/**
 * Get user's reaction to a post or comment
 */
export async function getUserReaction(
  userId: string,
  postId?: string,
  commentId?: string
): Promise<ReactionType | null> {
  if (!postId && !commentId) {
    return null;
  }

  const reaction = await prisma.reaction.findFirst({
    where: {
      userId,
      ...(postId ? { postId } : { commentId }),
    },
  });

  return reaction ? (reaction.type as ReactionType) : null;
}

/**
 * Get all reactions for a post or comment
 */
export async function getReactions(
  postId?: string,
  commentId?: string,
  limit = 50,
  offset = 0
) {
  if (!postId && !commentId) {
    throw new Error('Either postId or commentId must be provided');
  }

  return prisma.reaction.findMany({
    where: {
      ...(postId ? { postId } : { commentId }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });
}

/**
 * Mark a comment as accepted answer (only post author can do this)
 */
export async function markAcceptedAnswer(
  commentId: string,
  userId: string
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      post: true,
    },
  });

  if (!comment) {
    throw new Error('Comment not found');
  }

  if (comment.post.authorId !== userId) {
    throw new Error('Only post author can mark accepted answer');
  }

  // Remove any existing accepted reactions on this post's comments
  const postComments = await prisma.comment.findMany({
    where: { postId: comment.postId },
    select: { id: true },
  });

  const commentIds = postComments.map(c => c.id);

  await prisma.reaction.deleteMany({
    where: {
      commentId: { in: commentIds },
      type: 'accepted',
    },
  });

  // Add accepted reaction to this comment
  // The reaction is from the post author (who marks it as accepted)
  const result = await addReaction(userId, 'accepted', undefined, commentId);

  log.info('Accepted answer marked', { commentId, userId });
  return result;
}

/**
 * Update reputation based on reaction
 */
async function updateReputationForReaction(reaction: {
  id: string;
  userId: string;
  type: string;
  postId: string | null;
  commentId: string | null;
}) {
  try {
    // Import reputation service dynamically to avoid circular dependencies
    const { updateReputation } = await import('../reputation/models/ClinicianReputation.js');

    let targetUserId: string | null = null;

    if (reaction.postId) {
      const post = await prisma.post.findUnique({
        where: { id: reaction.postId },
        select: { authorId: true },
      });
      targetUserId = post?.authorId || null;
    } else if (reaction.commentId) {
      const comment = await prisma.comment.findUnique({
        where: { id: reaction.commentId },
        select: { authorId: true },
      });
      targetUserId = comment?.authorId || null;
    }

    if (!targetUserId) {
      return;
    }

    // Calculate peer review score based on reactions
    const postIds = await getPostIdsByAuthor(targetUserId);
    const commentIds = await getCommentIdsByAuthor(targetUserId);

    const upvotes = await prisma.reaction.count({
      where: {
        OR: [
          ...(postIds.length > 0 ? [{ postId: { in: postIds }, type: 'upvote' }] : []),
          ...(commentIds.length > 0 ? [{ commentId: { in: commentIds }, type: 'upvote' }] : []),
        ],
      },
    });

    const accepted = await prisma.reaction.count({
      where: {
        commentId: { in: commentIds },
        type: 'accepted',
      },
    });

    // Simple scoring: upvotes = 1 point, accepted = 5 points
    const peerReviewsScore = Math.min(100, (upvotes + accepted * 5) * 2);

    await updateReputation(targetUserId, {
      peerReviewsScore,
    });

    log.info('Reputation updated from reaction', {
      targetUserId,
      type: reaction.type,
      peerReviewsScore,
    });
  } catch (error) {
    log.error('Error updating reputation from reaction', { error, reaction });
    // Don't throw - reputation update is not critical
  }
}

async function getPostIdsByAuthor(authorId: string): Promise<string[]> {
  const posts = await prisma.post.findMany({
    where: { authorId },
    select: { id: true },
  });
  return posts.map(p => p.id);
}

async function getCommentIdsByAuthor(authorId: string): Promise<string[]> {
  const comments = await prisma.comment.findMany({
    where: { authorId },
    select: { id: true },
  });
  return comments.map(c => c.id);
}

