/**
 * B243B-KMS-019: TranslationManagementForKMS
 *
 * Extends i18n translation services for articles: supports multilingual content fields,
 * translation statuses (in-progress/completed), merging translations with versions;
 * integrates with i18n services.
 */

import { PrismaClient, TranslationStatus } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('kms/translation');

export interface TranslationInput {
  articleId: string;
  locale: string;
  title: string;
  body: string;
  summary?: string;
  translatorId?: string;
}

export interface ArticleTranslation {
  id: string;
  articleId: string;
  locale: string;
  title: string;
  body: string;
  summary: string | null;
  status: TranslationStatus;
  translatorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create or update a translation for an article
 */
export async function upsertTranslation(
  prisma: PrismaClient,
  input: TranslationInput
): Promise<ArticleTranslation> {
  // Validate article exists
  const article = await prisma.contentArticle.findUnique({
    where: { id: input.articleId },
  });

  if (!article) {
    throw new Error(`Article ${input.articleId} not found`);
  }

  // Validate locale format (basic check)
  if (!/^[a-z]{2}-[A-Z]{2}$/.test(input.locale)) {
    throw new Error(`Invalid locale format: ${input.locale}. Expected format: en-US`);
  }

  // Create or update translation
  const translation = await prisma.contentTranslation.upsert({
    where: {
      articleId_locale: {
        articleId: input.articleId,
        locale: input.locale,
      },
    },
    create: {
      articleId: input.articleId,
      locale: input.locale,
      title: input.title,
      body: input.body,
      summary: input.summary || null,
      status: 'IN_PROGRESS',
      translatorId: input.translatorId || null,
    },
    update: {
      title: input.title,
      body: input.body,
      summary: input.summary !== undefined ? input.summary : undefined,
      translatorId: input.translatorId !== undefined ? input.translatorId : undefined,
      status: input.body && input.title ? 'COMPLETED' : 'IN_PROGRESS',
    },
  });

  log.info('Translation upserted', {
    articleId: input.articleId,
    locale: input.locale,
    status: translation.status,
  });

  return translation;
}

/**
 * Get translation for an article
 */
export async function getTranslation(
  prisma: PrismaClient,
  articleId: string,
  locale: string
): Promise<ArticleTranslation | null> {
  return prisma.contentTranslation.findUnique({
    where: {
      articleId_locale: {
        articleId,
        locale,
      },
    },
  });
}

/**
 * Get all translations for an article
 */
export async function getArticleTranslations(
  prisma: PrismaClient,
  articleId: string
): Promise<ArticleTranslation[]> {
  return prisma.contentTranslation.findMany({
    where: { articleId },
    orderBy: { locale: 'asc' },
  });
}

/**
 * Update translation status
 */
export async function updateTranslationStatus(
  prisma: PrismaClient,
  articleId: string,
  locale: string,
  status: TranslationStatus
): Promise<ArticleTranslation> {
  return prisma.contentTranslation.update({
    where: {
      articleId_locale: {
        articleId,
        locale,
      },
    },
    data: { status },
  });
}

/**
 * Get article content in a specific locale (with fallback)
 */
export async function getArticleInLocale(
  prisma: PrismaClient,
  articleId: string,
  locale: string
): Promise<{
  title: string;
  body: string;
  summary: string | null;
  locale: string;
  isTranslated: boolean;
}> {
  // Try to get translation
  const translation = await getTranslation(prisma, articleId, locale);

  if (translation && translation.status === 'COMPLETED') {
    return {
      title: translation.title,
      body: translation.body,
      summary: translation.summary,
      locale: translation.locale,
      isTranslated: true,
    };
  }

  // Fallback to original article
  const article = await prisma.contentArticle.findUnique({
    where: { id: articleId },
  });

  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  return {
    title: article.title,
    body: article.body,
    summary: article.summary,
    locale: 'en-US', // Default locale
    isTranslated: false,
  };
}

/**
 * Get translations by status
 */
export async function getTranslationsByStatus(
  prisma: PrismaClient,
  status: TranslationStatus
): Promise<ArticleTranslation[]> {
  return prisma.contentTranslation.findMany({
    where: { status },
    include: {
      article: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Merge translation with article version
 * This would typically be used when publishing a translated version
 */
export async function mergeTranslationWithVersion(
  prisma: PrismaClient,
  articleId: string,
  locale: string
): Promise<boolean> {
  const translation = await getTranslation(prisma, articleId, locale);

  if (!translation || translation.status !== 'COMPLETED') {
    throw new Error('Translation not found or not completed');
  }

  // In a real implementation, this might create a new version or update the article
  // For now, we'll just mark it as merged
  log.info('Translation merged with version', { articleId, locale });
  return true;
}

