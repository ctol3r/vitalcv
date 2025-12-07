/**
 * B234A-COMM-004: ForumService
 *
 * Handles creating, updating, locking posts; adding comments; tagging and categorizing;
 * enforces auth and rate limits; includes basic moderation actions (delete/restore).
 */

import { PrismaClient } from '@prisma/client';
import {
  ForumCategory,
  ForumCategoryInput,
  createForumCategory,
  getForumCategory,
  listForumCategories,
  updateForumCategory,
} from './models/ForumCategory.js';
import {
  ForumPost,
  ForumPostInput,
  PostStatus,
  createForumPost,
  getForumPost,
  listForumPosts,
  updateForumPost,
  softDeleteForumPost,
  restoreForumPost,
  lockForumPost,
  pinForumPost,
  unpinForumPost,
} from './models/ForumPost.js';
import {
  ForumComment,
  ForumCommentInput,
  createForumComment,
  getForumComment,
  listForumComments,
  updateForumComment,
  softDeleteForumComment,
  restoreForumComment,
} from './models/ForumComment.js';
import { getServiceLogger } from '../logging/serviceLogger.js';

const log = getServiceLogger('community/forum');

export interface AuthContext {
  userId: string;
  roles: string[];
}

export interface RateLimitConfig {
  postsPerMinute: number;
  commentsPerMinute: number;
}

// Simple in-memory rate limiter (in production, use Redis)
class RateLimiter {
  private limits: Map<string, { count: number; resetTime: number }> = new Map();

  check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    let entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      this.limits.set(key, entry);
    }

    entry.count++;
    return entry.count <= maxRequests;
  }
}

const rateLimiter = new RateLimiter();
const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  postsPerMinute: 5,
  commentsPerMinute: 10,
};

/**
 * Check if user has required role
 */
function requireRole(user: AuthContext, requiredRoles: string[]): void {
  const hasRole = requiredRoles.some((role) => user.roles.includes(role));
  if (!hasRole) {
    throw new Error(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
  }
}

/**
 * Check rate limits
 */
function checkRateLimit(
  userId: string,
  action: 'post' | 'comment',
  config: RateLimitConfig = DEFAULT_RATE_LIMITS
): void {
  const key = `${userId}:${action}`;
  const maxRequests = action === 'post' ? config.postsPerMinute : config.commentsPerMinute;
  const allowed = rateLimiter.check(key, maxRequests, 60000); // 1 minute window

  if (!allowed) {
    throw new Error(
      `Rate limit exceeded. Maximum ${maxRequests} ${action}s per minute allowed.`
    );
  }
}

/**
 * Create a new forum category
 */
export async function createCategory(
  prisma: PrismaClient,
  input: ForumCategoryInput,
  auth: AuthContext
): Promise<ForumCategory> {
  requireRole(auth, ['admin', 'moderator']);
  log.info('Creating forum category', { name: input.name, userId: auth.userId });

  return createForumCategory(prisma, input);
}

/**
 * Get category by ID
 */
export async function getCategory(
  prisma: PrismaClient,
  categoryId: string,
  auth?: AuthContext
): Promise<ForumCategory | null> {
  const category = await getForumCategory(prisma, categoryId);
  if (!category) {
    return null;
  }

  // Check visibility for private categories
  if (category.visibility === 'private' && auth) {
    requireRole(auth, ['admin', 'moderator']);
  }

  return category;
}

/**
 * List categories
 */
export async function listCategories(
  prisma: PrismaClient,
  options?: { parentId?: string | null; visibility?: 'public' | 'private' },
  auth?: AuthContext
): Promise<ForumCategory[]> {
  // Non-admins can only see public categories
  if (!auth || !auth.roles.some((r) => ['admin', 'moderator'].includes(r))) {
    options = { ...options, visibility: 'public' };
  }

  return listForumCategories(prisma, options);
}

/**
 * Update category
 */
export async function updateCategory(
  prisma: PrismaClient,
  categoryId: string,
  updates: Partial<ForumCategoryInput>,
  auth: AuthContext
): Promise<ForumCategory> {
  requireRole(auth, ['admin', 'moderator']);
  log.info('Updating forum category', { categoryId, userId: auth.userId });

  return updateForumCategory(prisma, categoryId, updates);
}

/**
 * Create a new forum post
 */
export async function createPost(
  prisma: PrismaClient,
  input: ForumPostInput,
  auth: AuthContext
): Promise<ForumPost> {
  checkRateLimit(auth.userId, 'post');
  log.info('Creating forum post', { title: input.title, userId: auth.userId });

  // Ensure authorId matches authenticated user
  const postInput = { ...input, authorId: auth.userId };
  return createForumPost(prisma, postInput);
}

/**
 * Get post by ID
 */
export async function getPost(
  prisma: PrismaClient,
  postId: string,
  includeDeleted: boolean = false
): Promise<ForumPost | null> {
  return getForumPost(prisma, postId, includeDeleted);
}

/**
 * List posts with filters
 */
export async function listPosts(
  prisma: PrismaClient,
  options?: {
    categoryId?: string;
    authorId?: string;
    status?: PostStatus;
    tags?: string[];
    limit?: number;
    offset?: number;
  }
): Promise<ForumPost[]> {
  return listForumPosts(prisma, options);
}

/**
 * Update post (only author or moderator/admin)
 */
export async function updatePost(
  prisma: PrismaClient,
  postId: string,
  updates: Partial<ForumPostInput> & { status?: PostStatus },
  auth: AuthContext
): Promise<ForumPost> {
  const post = await getPost(prisma, postId);
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  // Only author or moderator/admin can update
  if (post.authorId !== auth.userId) {
    requireRole(auth, ['admin', 'moderator']);
  }

  log.info('Updating forum post', { postId, userId: auth.userId });
  return updateForumPost(prisma, postId, updates);
}

/**
 * Lock a post (prevents new comments)
 */
export async function lockPost(
  prisma: PrismaClient,
  postId: string,
  auth: AuthContext
): Promise<ForumPost> {
  requireRole(auth, ['admin', 'moderator']);
  log.info('Locking forum post', { postId, userId: auth.userId });
  return lockForumPost(prisma, postId);
}

/**
 * Pin a post
 */
export async function pinPost(
  prisma: PrismaClient,
  postId: string,
  auth: AuthContext
): Promise<ForumPost> {
  requireRole(auth, ['admin', 'moderator']);
  log.info('Pinning forum post', { postId, userId: auth.userId });
  return pinForumPost(prisma, postId);
}

/**
 * Unpin a post
 */
export async function unpinPost(
  prisma: PrismaClient,
  postId: string,
  auth: AuthContext
): Promise<ForumPost> {
  requireRole(auth, ['admin', 'moderator']);
  log.info('Unpinning forum post', { postId, userId: auth.userId });
  return unpinForumPost(prisma, postId);
}

/**
 * Add tags to a post
 */
export async function addTags(
  prisma: PrismaClient,
  postId: string,
  tags: string[],
  auth: AuthContext
): Promise<ForumPost> {
  const post = await getPost(prisma, postId);
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  // Only author or moderator/admin can add tags
  if (post.authorId !== auth.userId) {
    requireRole(auth, ['admin', 'moderator']);
  }

  const existingTags = post.tags || [];
  const newTags = [...new Set([...existingTags, ...tags])]; // Remove duplicates

  return updateForumPost(prisma, postId, { tags: newTags });
}

/**
 * Remove tags from a post
 */
export async function removeTags(
  prisma: PrismaClient,
  postId: string,
  tags: string[],
  auth: AuthContext
): Promise<ForumPost> {
  const post = await getPost(prisma, postId);
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  // Only author or moderator/admin can remove tags
  if (post.authorId !== auth.userId) {
    requireRole(auth, ['admin', 'moderator']);
  }

  const existingTags = post.tags || [];
  const newTags = existingTags.filter((tag) => !tags.includes(tag));

  return updateForumPost(prisma, postId, { tags: newTags });
}

/**
 * Create a comment on a post
 */
export async function createComment(
  prisma: PrismaClient,
  input: ForumCommentInput,
  auth: AuthContext
): Promise<ForumComment> {
  checkRateLimit(auth.userId, 'comment');
  log.info('Creating forum comment', { postId: input.postId, userId: auth.userId });

  // Ensure authorId matches authenticated user
  const commentInput = { ...input, authorId: auth.userId };
  return createForumComment(prisma, commentInput);
}

/**
 * Get comment by ID
 */
export async function getComment(
  prisma: PrismaClient,
  commentId: string,
  includeDeleted: boolean = false
): Promise<ForumComment | null> {
  return getForumComment(prisma, commentId, includeDeleted);
}

/**
 * List comments for a post
 */
export async function listComments(
  prisma: PrismaClient,
  postId: string,
  options?: {
    parentCommentId?: string | null;
    authorId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ForumComment[]> {
  return listForumComments(prisma, {
    postId,
    ...options,
  });
}

/**
 * Update comment (only author or moderator/admin)
 */
export async function updateComment(
  prisma: PrismaClient,
  commentId: string,
  updates: { body: string },
  auth: AuthContext
): Promise<ForumComment> {
  const comment = await getComment(prisma, commentId);
  if (!comment) {
    throw new Error(`Comment ${commentId} not found`);
  }

  // Only author or moderator/admin can update
  if (comment.authorId !== auth.userId) {
    requireRole(auth, ['admin', 'moderator']);
  }

  log.info('Updating forum comment', { commentId, userId: auth.userId });
  return updateForumComment(prisma, commentId, updates);
}

/**
 * Delete post (soft delete)
 */
export async function deletePost(
  prisma: PrismaClient,
  postId: string,
  auth: AuthContext
): Promise<ForumPost> {
  const post = await getPost(prisma, postId);
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  // Only author or moderator/admin can delete
  if (post.authorId !== auth.userId) {
    requireRole(auth, ['admin', 'moderator']);
  }

  log.info('Deleting forum post', { postId, userId: auth.userId });
  return softDeleteForumPost(prisma, postId);
}

/**
 * Restore deleted post
 */
export async function restorePost(
  prisma: PrismaClient,
  postId: string,
  auth: AuthContext
): Promise<ForumPost> {
  requireRole(auth, ['admin', 'moderator']);
  log.info('Restoring forum post', { postId, userId: auth.userId });
  return restoreForumPost(prisma, postId);
}

/**
 * Delete comment (soft delete)
 */
export async function deleteComment(
  prisma: PrismaClient,
  commentId: string,
  auth: AuthContext
): Promise<ForumComment> {
  const comment = await getComment(prisma, commentId);
  if (!comment) {
    throw new Error(`Comment ${commentId} not found`);
  }

  // Only author or moderator/admin can delete
  if (comment.authorId !== auth.userId) {
    requireRole(auth, ['admin', 'moderator']);
  }

  log.info('Deleting forum comment', { commentId, userId: auth.userId });
  return softDeleteForumComment(prisma, commentId);
}

/**
 * Restore deleted comment
 */
export async function restoreComment(
  prisma: PrismaClient,
  commentId: string,
  auth: AuthContext
): Promise<ForumComment> {
  requireRole(auth, ['admin', 'moderator']);
  log.info('Restoring forum comment', { commentId, userId: auth.userId });
  return restoreForumComment(prisma, commentId);
}

