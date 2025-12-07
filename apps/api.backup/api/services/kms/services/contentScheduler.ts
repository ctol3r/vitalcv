/**
 * B243B-KMS-015: ContentScheduler
 *
 * Allows scheduling publication of articles at future dates/times.
 * Monitors scheduled items and publishes automatically when time arrives.
 * Sends confirmation notifications.
 */

import { PrismaClient } from '@prisma/client';
import { createNotification } from '../../notifications/notificationService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('kms/content-scheduler');

export interface ScheduleInput {
  articleId: string;
  scheduledAt: Date;
}

export interface ScheduledItem {
  id: string;
  articleId: string;
  scheduledAt: Date;
  published: boolean;
  createdAt: Date;
}

/**
 * Schedule an article for publication
 */
export async function schedulePublication(
  prisma: PrismaClient,
  input: ScheduleInput
): Promise<ScheduledItem> {
  // Validate article exists
  const article = await prisma.contentArticle.findUnique({
    where: { id: input.articleId },
    include: { author: true },
  });

  if (!article) {
    throw new Error(`Article ${input.articleId} not found`);
  }

  // Validate scheduled time is in the future
  if (input.scheduledAt <= new Date()) {
    throw new Error('Scheduled time must be in the future');
  }

  // Check if article is in a publishable state
  if (article.status !== 'DRAFT' && article.status !== 'REVIEW') {
    throw new Error('Only draft or review articles can be scheduled');
  }

  // Create or update schedule
  const schedule = await prisma.contentSchedule.upsert({
    where: { articleId: input.articleId },
    create: {
      articleId: input.articleId,
      scheduledAt: input.scheduledAt,
      published: false,
    },
    update: {
      scheduledAt: input.scheduledAt,
      published: false,
    },
  });

  // Send confirmation notification to author
  try {
    if (article.author.userId) {
      await createNotification(
        article.author.userId,
        'ARTICLE_SCHEDULED',
        {
          articleId: input.articleId,
          articleTitle: article.title,
          scheduledAt: input.scheduledAt.toISOString(),
        }
      );
    }
  } catch (error) {
    log.warn('Failed to send scheduling notification', { error, articleId: input.articleId });
  }

  log.info('Article scheduled for publication', {
    articleId: input.articleId,
    scheduledAt: input.scheduledAt,
  });

  return schedule;
}

/**
 * Cancel a scheduled publication
 */
export async function cancelScheduledPublication(
  prisma: PrismaClient,
  articleId: string
): Promise<boolean> {
  const schedule = await prisma.contentSchedule.findUnique({
    where: { articleId },
  });

  if (!schedule) {
    return false; // Not scheduled
  }

  if (schedule.published) {
    throw new Error('Cannot cancel already published article');
  }

  await prisma.contentSchedule.delete({
    where: { id: schedule.id },
  });

  log.info('Scheduled publication cancelled', { articleId });
  return true;
}

/**
 * Get scheduled items that are due for publication
 */
export async function getDueScheduledItems(
  prisma: PrismaClient,
  now: Date = new Date()
): Promise<ScheduledItem[]> {
  return prisma.contentSchedule.findMany({
    where: {
      scheduledAt: {
        lte: now,
      },
      published: false,
    },
    include: {
      article: true,
    },
  });
}

/**
 * Publish scheduled articles (should be run periodically by a cron job)
 */
export async function publishScheduledArticles(
  prisma: PrismaClient
): Promise<number> {
  const dueItems = await getDueScheduledItems(prisma);

  let publishedCount = 0;

  for (const item of dueItems) {
    try {
      // Update article status to PUBLISHED
      await prisma.contentArticle.update({
        where: { id: item.articleId },
        data: {
          status: 'PUBLISHED',
          publishDate: item.scheduledAt,
        },
      });

      // Mark schedule as published
      await prisma.contentSchedule.update({
        where: { id: item.id },
        data: { published: true },
      });

      // Send notification to author
      const article = await prisma.contentArticle.findUnique({
        where: { id: item.articleId },
        include: { author: true },
      });

      if (article?.author.userId) {
        try {
          await createNotification(
            article.author.userId,
            'ARTICLE_PUBLISHED',
            {
              articleId: item.articleId,
              articleTitle: article.title,
              publishedAt: item.scheduledAt.toISOString(),
            }
          );
        } catch (error) {
          log.warn('Failed to send publication notification', {
            error,
            articleId: item.articleId,
          });
        }
      }

      publishedCount++;
      log.info('Scheduled article published', {
        articleId: item.articleId,
        scheduledAt: item.scheduledAt,
      });
    } catch (error) {
      log.error('Failed to publish scheduled article', {
        articleId: item.articleId,
        error,
      });
    }
  }

  if (publishedCount > 0) {
    log.info('Published scheduled articles', { count: publishedCount });
  }

  return publishedCount;
}

/**
 * Get all scheduled items (for admin dashboard)
 */
export async function getAllScheduledItems(
  prisma: PrismaClient,
  includePublished: boolean = false
): Promise<ScheduledItem[]> {
  return prisma.contentSchedule.findMany({
    where: includePublished ? undefined : { published: false },
    orderBy: { scheduledAt: 'asc' },
    include: {
      article: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });
}

