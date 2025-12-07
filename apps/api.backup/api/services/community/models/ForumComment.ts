/**
 * B234A-COMM-003: ForumComment Model
 *
 * Model for forum comments with threaded replies and soft deletion support.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export interface ForumCommentInput {
  postId: string;
  authorId: string;
  body: string;
  parentCommentId?: string | null;
}

export interface ForumComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  authorId: string;
  body: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new forum comment
 */
export async function createForumComment(
  prisma: PrismaClient,
  input: ForumCommentInput
): Promise<ForumComment> {
  // Validate post exists and is not locked or deleted
  const post = await prisma.forumPost.findFirst({
    where: {
      id: input.postId,
      deletedAt: null,
    },
  });
  if (!post) {
    throw new Error(`Post ${input.postId} not found or deleted`);
  }
  if (post.status === 'locked') {
    throw new Error(`Post ${input.postId} is locked`);
  }

  // Validate author exists
  const author = await prisma.user.findUnique({
    where: { id: input.authorId },
  });
  if (!author) {
    throw new Error(`Author ${input.authorId} not found`);
  }

  // Validate parent comment exists if provided
  if (input.parentCommentId) {
    const parent = await prisma.forumComment.findFirst({
      where: {
        id: input.parentCommentId,
        postId: input.postId, // Parent must be on same post
        deletedAt: null,
      },
    });
    if (!parent) {
      throw new Error(`Parent comment ${input.parentCommentId} not found or deleted`);
    }
  }

  return prisma.forumComment.create({
    data: {
      postId: input.postId,
      authorId: input.authorId,
      body: input.body,
      parentCommentId: input.parentCommentId ?? null,
    },
  });
}

/**
 * Get forum comment by ID (excluding soft-deleted)
 */
export async function getForumComment(
  prisma: PrismaClient,
  commentId: string,
  includeDeleted: boolean = false
): Promise<ForumComment | null> {
  const where: Prisma.ForumCommentWhereInput = { id: commentId };
  if (!includeDeleted) {
    where.deletedAt = null;
  }

  return prisma.forumComment.findFirst({
    where,
  });
}

/**
 * List forum comments for a post with optional filters
 */
export async function listForumComments(
  prisma: PrismaClient,
  options: {
    postId: string;
    parentCommentId?: string | null;
    authorId?: string;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<ForumComment[]> {
  const where: Prisma.ForumCommentWhereInput = {
    postId: options.postId,
  };

  if (options.parentCommentId !== undefined) {
    where.parentCommentId = options.parentCommentId;
  }
  if (options.authorId) {
    where.authorId = options.authorId;
  }
  if (!options.includeDeleted) {
    where.deletedAt = null;
  }

  return prisma.forumComment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: options.limit,
    skip: options.offset,
  });
}

/**
 * Get threaded comments (replies) for a comment
 */
export async function getCommentReplies(
  prisma: PrismaClient,
  commentId: string,
  includeDeleted: boolean = false
): Promise<ForumComment[]> {
  const comment = await getForumComment(prisma, commentId, includeDeleted);
  if (!comment) {
    return [];
  }

  const where: Prisma.ForumCommentWhereInput = {
    postId: comment.postId,
    parentCommentId: commentId,
  };
  if (!includeDeleted) {
    where.deletedAt = null;
  }

  return prisma.forumComment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Update forum comment
 */
export async function updateForumComment(
  prisma: PrismaClient,
  commentId: string,
  updates: { body: string }
): Promise<ForumComment> {
  const comment = await getForumComment(prisma, commentId);
  if (!comment) {
    throw new Error(`Comment ${commentId} not found`);
  }

  return prisma.forumComment.update({
    where: { id: commentId },
    data: { body: updates.body },
  });
}

/**
 * Soft delete forum comment
 */
export async function softDeleteForumComment(
  prisma: PrismaClient,
  commentId: string
): Promise<ForumComment> {
  const comment = await getForumComment(prisma, commentId);
  if (!comment) {
    throw new Error(`Comment ${commentId} not found`);
  }

  if (comment.deletedAt) {
    throw new Error(`Comment ${commentId} is already deleted`);
  }

  return prisma.forumComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Restore soft-deleted forum comment
 */
export async function restoreForumComment(
  prisma: PrismaClient,
  commentId: string
): Promise<ForumComment> {
  const comment = await getForumComment(prisma, commentId, true);
  if (!comment) {
    throw new Error(`Comment ${commentId} not found`);
  }

  if (!comment.deletedAt) {
    throw new Error(`Comment ${commentId} is not deleted`);
  }

  return prisma.forumComment.update({
    where: { id: commentId },
    data: { deletedAt: null },
  });
}

