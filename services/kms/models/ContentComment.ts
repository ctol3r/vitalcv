/**
 * B243B-KMS-013: ContentComment Model
 *
 * Model for inline comments on article drafts with reply threads.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export interface ContentCommentInput {
  articleId: string;
  authorId: string;
  body: string;
  parentId?: string; // For reply threads
}

export interface ContentComment {
  id: string;
  articleId: string;
  authorId: string;
  body: string;
  resolved: boolean;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new comment on an article
 */
export async function createContentComment(
  prisma: PrismaClient,
  input: ContentCommentInput
): Promise<ContentComment> {
  // Validate article exists
  const article = await prisma.contentArticle.findUnique({
    where: { id: input.articleId },
  });
  if (!article) {
    throw new Error(`Article ${input.articleId} not found`);
  }

  // Validate author exists
  const author = await prisma.user.findUnique({
    where: { id: input.authorId },
  });
  if (!author) {
    throw new Error(`Author ${input.authorId} not found`);
  }

  // If parentId is provided, validate parent comment exists
  if (input.parentId) {
    const parent = await prisma.contentComment.findUnique({
      where: { id: input.parentId },
    });
    if (!parent) {
      throw new Error(`Parent comment ${input.parentId} not found`);
    }
    if (parent.articleId !== input.articleId) {
      throw new Error('Parent comment must be on the same article');
    }
  }

  return prisma.contentComment.create({
    data: {
      articleId: input.articleId,
      authorId: input.authorId,
      body: input.body,
      parentId: input.parentId || null,
      resolved: false,
    },
  });
}

/**
 * Get comment by ID
 */
export async function getContentComment(
  prisma: PrismaClient,
  commentId: string
): Promise<ContentComment | null> {
  return prisma.contentComment.findUnique({
    where: { id: commentId },
    include: {
      replies: true,
    },
  });
}

/**
 * List comments for an article
 */
export async function listContentComments(
  prisma: PrismaClient,
  articleId: string,
  includeReplies: boolean = true
): Promise<ContentComment[]> {
  const where: Prisma.ContentCommentWhereInput = {
    articleId,
    parentId: includeReplies ? undefined : null, // Only top-level comments if includeReplies is false
  };

  return prisma.contentComment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: includeReplies ? { replies: true } : undefined,
  });
}

/**
 * Update comment
 */
export async function updateContentComment(
  prisma: PrismaClient,
  commentId: string,
  updates: { body?: string; resolved?: boolean }
): Promise<ContentComment> {
  return prisma.contentComment.update({
    where: { id: commentId },
    data: updates,
  });
}

/**
 * Resolve a comment
 */
export async function resolveContentComment(
  prisma: PrismaClient,
  commentId: string
): Promise<ContentComment> {
  return prisma.contentComment.update({
    where: { id: commentId },
    data: { resolved: true },
  });
}

/**
 * Delete a comment (soft delete by setting resolved to true, or hard delete)
 */
export async function deleteContentComment(
  prisma: PrismaClient,
  commentId: string,
  hardDelete: boolean = false
): Promise<void> {
  if (hardDelete) {
    await prisma.contentComment.delete({
      where: { id: commentId },
    });
  } else {
    // Soft delete by resolving
    await resolveContentComment(prisma, commentId);
  }
}

