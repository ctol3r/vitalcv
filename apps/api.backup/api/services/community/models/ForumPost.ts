/**
 * B234A-COMM-002: ForumPost Model
 *
 * Model for forum posts with markdown content, tags, status management, and soft deletion.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export type PostStatus = 'active' | 'locked' | 'pinned';

export interface ForumPostInput {
  categoryId: string;
  authorId: string;
  title: string;
  body: string; // Markdown content
  tags?: string[];
  status?: PostStatus;
}

export interface ForumPost {
  id: string;
  categoryId: string;
  authorId: string;
  title: string;
  body: string;
  tags: string[];
  status: PostStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate post status
 */
export function validatePostStatus(status: string): PostStatus {
  const validStatuses: PostStatus[] = ['active', 'locked', 'pinned'];
  if (!validStatuses.includes(status as PostStatus)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }
  return status as PostStatus;
}

/**
 * Create a new forum post
 */
export async function createForumPost(
  prisma: PrismaClient,
  input: ForumPostInput
): Promise<ForumPost> {
  // Validate category exists
  const category = await prisma.forumCategory.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) {
    throw new Error(`Category ${input.categoryId} not found`);
  }

  // Validate author exists
  const author = await prisma.user.findUnique({
    where: { id: input.authorId },
  });
  if (!author) {
    throw new Error(`Author ${input.authorId} not found`);
  }

  return prisma.forumPost.create({
    data: {
      categoryId: input.categoryId,
      authorId: input.authorId,
      title: input.title,
      body: input.body,
      tags: input.tags || [],
      status: input.status || 'active',
    },
  });
}

/**
 * Get forum post by ID (excluding soft-deleted)
 */
export async function getForumPost(
  prisma: PrismaClient,
  postId: string,
  includeDeleted: boolean = false
): Promise<ForumPost | null> {
  const where: Prisma.ForumPostWhereInput = { id: postId };
  if (!includeDeleted) {
    where.deletedAt = null;
  }

  return prisma.forumPost.findFirst({
    where,
  });
}

/**
 * List forum posts with optional filters
 */
export async function listForumPosts(
  prisma: PrismaClient,
  options?: {
    categoryId?: string;
    authorId?: string;
    status?: PostStatus;
    tags?: string[];
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<ForumPost[]> {
  const where: Prisma.ForumPostWhereInput = {};

  if (options?.categoryId) {
    where.categoryId = options.categoryId;
  }
  if (options?.authorId) {
    where.authorId = options.authorId;
  }
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.tags && options.tags.length > 0) {
    where.tags = { hasSome: options.tags };
  }
  if (!options?.includeDeleted) {
    where.deletedAt = null;
  }

  return prisma.forumPost.findMany({
    where,
    orderBy: [
      { status: 'desc' }, // Pinned posts first
      { createdAt: 'desc' },
    ],
    take: options?.limit,
    skip: options?.offset,
  });
}

/**
 * Update forum post
 */
export async function updateForumPost(
  prisma: PrismaClient,
  postId: string,
  updates: Partial<ForumPostInput> & { status?: PostStatus }
): Promise<ForumPost> {
  const post = await getForumPost(prisma, postId);
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  const data: Prisma.ForumPostUpdateInput = {};
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.body !== undefined) data.body = updates.body;
  if (updates.tags !== undefined) data.tags = updates.tags;
  if (updates.status !== undefined) {
    data.status = validatePostStatus(updates.status);
  }
  if (updates.categoryId !== undefined) {
    // Validate category exists
    const category = await prisma.forumCategory.findUnique({
      where: { id: updates.categoryId },
    });
    if (!category) {
      throw new Error(`Category ${updates.categoryId} not found`);
    }
    data.categoryId = updates.categoryId;
  }

  return prisma.forumPost.update({
    where: { id: postId },
    data,
  });
}

/**
 * Soft delete forum post
 */
export async function softDeleteForumPost(
  prisma: PrismaClient,
  postId: string
): Promise<ForumPost> {
  const post = await getForumPost(prisma, postId);
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  if (post.deletedAt) {
    throw new Error(`Post ${postId} is already deleted`);
  }

  return prisma.forumPost.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Restore soft-deleted forum post
 */
export async function restoreForumPost(
  prisma: PrismaClient,
  postId: string
): Promise<ForumPost> {
  const post = await getForumPost(prisma, postId, true);
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  if (!post.deletedAt) {
    throw new Error(`Post ${postId} is not deleted`);
  }

  return prisma.forumPost.update({
    where: { id: postId },
    data: { deletedAt: null },
  });
}

/**
 * Lock a forum post (prevents new comments)
 */
export async function lockForumPost(
  prisma: PrismaClient,
  postId: string
): Promise<ForumPost> {
  return updateForumPost(prisma, postId, { status: 'locked' });
}

/**
 * Pin a forum post
 */
export async function pinForumPost(
  prisma: PrismaClient,
  postId: string
): Promise<ForumPost> {
  return updateForumPost(prisma, postId, { status: 'pinned' });
}

/**
 * Unpin a forum post
 */
export async function unpinForumPost(
  prisma: PrismaClient,
  postId: string
): Promise<ForumPost> {
  return updateForumPost(prisma, postId, { status: 'active' });
}

