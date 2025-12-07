/**
 * B243B-KMS-016: SEO & MetadataService
 *
 * Manages SEO metadata for articles: meta title, meta description, canonical URL,
 * OpenGraph tags. Validates length and format; optionally auto-generates from content summary.
 */

import { PrismaClient } from '@prisma/client';
import { extractTextFromHtml } from '../integrations/wysiwygEditor.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('kms/metadata');

export interface MetadataInput {
  articleId: string;
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  openGraphTitle?: string;
  openGraphDescription?: string;
  openGraphImage?: string;
}

export interface ArticleMetadata {
  id: string;
  articleId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  openGraphImage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_META_TITLE_LENGTH = 60;
const MAX_META_DESCRIPTION_LENGTH = 160;
const MAX_OG_TITLE_LENGTH = 60;
const MAX_OG_DESCRIPTION_LENGTH = 200;

/**
 * Validate metadata fields
 */
export function validateMetadata(input: Partial<MetadataInput>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.metaTitle && input.metaTitle.length > MAX_META_TITLE_LENGTH) {
    errors.push(`Meta title exceeds ${MAX_META_TITLE_LENGTH} characters`);
  }

  if (input.metaDescription && input.metaDescription.length > MAX_META_DESCRIPTION_LENGTH) {
    errors.push(`Meta description exceeds ${MAX_META_DESCRIPTION_LENGTH} characters`);
  }

  if (input.openGraphTitle && input.openGraphTitle.length > MAX_OG_TITLE_LENGTH) {
    errors.push(`OpenGraph title exceeds ${MAX_OG_TITLE_LENGTH} characters`);
  }

  if (input.openGraphDescription && input.openGraphDescription.length > MAX_OG_DESCRIPTION_LENGTH) {
    errors.push(`OpenGraph description exceeds ${MAX_OG_DESCRIPTION_LENGTH} characters`);
  }

  if (input.canonicalUrl) {
    try {
      new URL(input.canonicalUrl);
    } catch {
      errors.push('Canonical URL must be a valid URL');
    }
  }

  if (input.openGraphImage) {
    try {
      new URL(input.openGraphImage);
    } catch {
      errors.push('OpenGraph image must be a valid URL');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Auto-generate metadata from article content
 */
export async function autoGenerateMetadata(
  prisma: PrismaClient,
  articleId: string
): Promise<Partial<MetadataInput>> {
  const article = await prisma.contentArticle.findUnique({
    where: { id: articleId },
  });

  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  const plainText = extractTextFromHtml(article.body);
  const summary = article.summary || plainText.substring(0, 200);

  // Generate meta title from article title (truncate if needed)
  const metaTitle = article.title.length > MAX_META_TITLE_LENGTH
    ? article.title.substring(0, MAX_META_TITLE_LENGTH - 3) + '...'
    : article.title;

  // Generate meta description from summary
  const metaDescription = summary.length > MAX_META_DESCRIPTION_LENGTH
    ? summary.substring(0, MAX_META_DESCRIPTION_LENGTH - 3) + '...'
    : summary;

  return {
    articleId,
    metaTitle,
    metaDescription,
    openGraphTitle: metaTitle,
    openGraphDescription: metaDescription,
  };
}

/**
 * Create or update metadata for an article
 */
export async function upsertMetadata(
  prisma: PrismaClient,
  input: MetadataInput
): Promise<ArticleMetadata> {
  // Validate article exists
  const article = await prisma.contentArticle.findUnique({
    where: { id: input.articleId },
  });

  if (!article) {
    throw new Error(`Article ${input.articleId} not found`);
  }

  // Validate metadata
  const validation = validateMetadata(input);
  if (!validation.valid) {
    throw new Error(`Invalid metadata: ${validation.errors.join(', ')}`);
  }

  // Create or update metadata
  const metadata = await prisma.contentMetadata.upsert({
    where: { articleId: input.articleId },
    create: {
      articleId: input.articleId,
      metaTitle: input.metaTitle || null,
      metaDescription: input.metaDescription || null,
      canonicalUrl: input.canonicalUrl || null,
      openGraphTitle: input.openGraphTitle || null,
      openGraphDescription: input.openGraphDescription || null,
      openGraphImage: input.openGraphImage || null,
    },
    update: {
      metaTitle: input.metaTitle !== undefined ? input.metaTitle : undefined,
      metaDescription: input.metaDescription !== undefined ? input.metaDescription : undefined,
      canonicalUrl: input.canonicalUrl !== undefined ? input.canonicalUrl : undefined,
      openGraphTitle: input.openGraphTitle !== undefined ? input.openGraphTitle : undefined,
      openGraphDescription: input.openGraphDescription !== undefined ? input.openGraphDescription : undefined,
      openGraphImage: input.openGraphImage !== undefined ? input.openGraphImage : undefined,
    },
  });

  log.info('Metadata updated', { articleId: input.articleId });
  return metadata;
}

/**
 * Get metadata for an article
 */
export async function getMetadata(
  prisma: PrismaClient,
  articleId: string
): Promise<ArticleMetadata | null> {
  return prisma.contentMetadata.findUnique({
    where: { articleId },
  });
}

/**
 * Get metadata with auto-generation fallback
 */
export async function getMetadataWithFallback(
  prisma: PrismaClient,
  articleId: string
): Promise<ArticleMetadata> {
  let metadata = await getMetadata(prisma, articleId);

  if (!metadata) {
    // Auto-generate and save
    const autoMetadata = await autoGenerateMetadata(prisma, articleId);
    metadata = await upsertMetadata(prisma, autoMetadata as MetadataInput);
  }

  return metadata;
}

