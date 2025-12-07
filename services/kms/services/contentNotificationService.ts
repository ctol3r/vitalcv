/**
 * B243B-KMS-020: ContentNotificationService
 *
 * Allows users to subscribe to categories/tags; sends notifications when new articles
 * are published or updated; integrates with the platform's NotificationService;
 * logs opt-in/out actions.
 */

import { PrismaClient } from '@prisma/client';
import { createNotification } from '../../notifications/notificationService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('kms/content-notifications');

export interface SubscriptionInput {
  userId: string;
  categoryId?: string;
  tagId?: string;
}

export interface ContentSubscription {
  id: string;
  userId: string;
  categoryId: string | null;
  tagId: string | null;
  createdAt: Date;
}

/**
 * Subscribe to category or tag
 */
export async function subscribe(
  prisma: PrismaClient,
  input: SubscriptionInput
): Promise<ContentSubscription> {
  // Validate user exists
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error(`User ${input.userId} not found`);
  }

  // Validate category or tag exists
  if (input.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) {
      throw new Error(`Category ${input.categoryId} not found`);
    }
  }

  if (input.tagId) {
    const tag = await prisma.tag.findUnique({
      where: { id: input.tagId },
    });
    if (!tag) {
      throw new Error(`Tag ${input.tagId} not found`);
    }
  }

  if (!input.categoryId && !input.tagId) {
    throw new Error('Either categoryId or tagId must be provided');
  }

  // Create subscription
  const subscription = await prisma.contentSubscription.create({
    data: {
      userId: input.userId,
      categoryId: input.categoryId || null,
      tagId: input.tagId || null,
    },
  });

  log.info('User subscribed to content', {
    userId: input.userId,
    categoryId: input.categoryId,
    tagId: input.tagId,
  });

  return subscription;
}

/**
 * Unsubscribe from category or tag
 */
export async function unsubscribe(
  prisma: PrismaClient,
  userId: string,
  categoryId?: string,
  tagId?: string
): Promise<boolean> {
  const where: any = { userId };

  if (categoryId) {
    where.categoryId = categoryId;
  } else {
    where.categoryId = null;
  }

  if (tagId) {
    where.tagId = tagId;
  } else {
    where.tagId = null;
  }

  const result = await prisma.contentSubscription.deleteMany({
    where,
  });

  if (result.count > 0) {
    log.info('User unsubscribed from content', {
      userId,
      categoryId,
      tagId,
    });
    return true;
  }

  return false;
}

/**
 * Get user subscriptions
 */
export async function getUserSubscriptions(
  prisma: PrismaClient,
  userId: string
): Promise<ContentSubscription[]> {
  return prisma.contentSubscription.findMany({
    where: { userId },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Notify subscribers when a new article is published
 */
export async function notifySubscribers(
  prisma: PrismaClient,
  articleId: string
): Promise<number> {
  const article = await prisma.contentArticle.findUnique({
    where: { id: articleId },
    include: {
      categories: {
        include: { category: true },
      },
      tags: {
        include: { tag: true },
      },
      author: true,
    },
  });

  if (!article || article.status !== 'PUBLISHED') {
    log.warn('Cannot notify subscribers for non-published article', { articleId });
    return 0;
  }

  // Get category and tag IDs
  const categoryIds = article.categories.map((c) => c.categoryId);
  const tagIds = article.tags.map((t) => t.tagId);

  // Find subscribers
  const subscriptions = await prisma.contentSubscription.findMany({
    where: {
      OR: [
        ...(categoryIds.length > 0
          ? [{ categoryId: { in: categoryIds } }]
          : []),
        ...(tagIds.length > 0 ? [{ tagId: { in: tagIds } }] : []),
      ],
    },
    distinct: ['userId'],
  });

  let notifiedCount = 0;

  for (const subscription of subscriptions) {
    try {
      await createNotification(
        subscription.userId,
        'NEW_ARTICLE_PUBLISHED',
        {
          articleId: article.id,
          articleTitle: article.title,
          articleSummary: article.summary,
          authorName: article.author.name,
          categories: article.categories.map((c) => c.category.name),
          tags: article.tags.map((t) => t.tag.name),
        }
      );
      notifiedCount++;
    } catch (error) {
      log.warn('Failed to send notification to subscriber', {
        userId: subscription.userId,
        articleId,
        error,
      });
    }
  }

  log.info('Notified subscribers of new article', {
    articleId,
    subscriberCount: subscriptions.length,
    notifiedCount,
  });

  return notifiedCount;
}

/**
 * Notify subscribers when an article is updated
 */
export async function notifySubscribersOfUpdate(
  prisma: PrismaClient,
  articleId: string
): Promise<number> {
  const article = await prisma.contentArticle.findUnique({
    where: { id: articleId },
    include: {
      categories: {
        include: { category: true },
      },
      tags: {
        include: { tag: true },
      },
      author: true,
    },
  });

  if (!article) {
    return 0;
  }

  // Get category and tag IDs
  const categoryIds = article.categories.map((c) => c.categoryId);
  const tagIds = article.tags.map((t) => t.tagId);

  // Find subscribers
  const subscriptions = await prisma.contentSubscription.findMany({
    where: {
      OR: [
        ...(categoryIds.length > 0
          ? [{ categoryId: { in: categoryIds } }]
          : []),
        ...(tagIds.length > 0 ? [{ tagId: { in: tagIds } }] : []),
      ],
    },
    distinct: ['userId'],
  });

  let notifiedCount = 0;

  for (const subscription of subscriptions) {
    try {
      await createNotification(
        subscription.userId,
        'ARTICLE_UPDATED',
        {
          articleId: article.id,
          articleTitle: article.title,
          updatedAt: article.updatedAt.toISOString(),
        }
      );
      notifiedCount++;
    } catch (error) {
      log.warn('Failed to send update notification to subscriber', {
        userId: subscription.userId,
        articleId,
        error,
      });
    }
  }

  log.info('Notified subscribers of article update', {
    articleId,
    subscriberCount: subscriptions.length,
    notifiedCount,
  });

  return notifiedCount;
}

/**
 * Check if user is subscribed
 */
export async function isSubscribed(
  prisma: PrismaClient,
  userId: string,
  categoryId?: string,
  tagId?: string
): Promise<boolean> {
  const where: any = { userId };

  if (categoryId) {
    where.categoryId = categoryId;
  } else {
    where.categoryId = null;
  }

  if (tagId) {
    where.tagId = tagId;
  } else {
    where.tagId = null;
  }

  const subscription = await prisma.contentSubscription.findFirst({
    where,
  });

  return subscription !== null;
}

