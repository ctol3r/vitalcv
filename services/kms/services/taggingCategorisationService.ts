/**
 * B243B-KMS-017: Tagging & Categorisation Service
 *
 * Suggests tags/categories based on article content using simple keyword extraction.
 * Allows editors to accept or override suggestions; updates search index accordingly.
 */

import { PrismaClient } from '@prisma/client';
import { extractTextFromHtml } from '../integrations/wysiwygEditor.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('kms/tagging');

export interface TagSuggestion {
  tagId: string;
  tagName: string;
  confidence: number;
  reason: string;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reason: string;
}

// Common stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
  'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
]);

/**
 * Extract keywords from text
 */
function extractKeywords(text: string, minLength: number = 3, maxKeywords: number = 20): string[] {
  // Convert to lowercase and split into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= minLength && !STOP_WORDS.has(word));

  // Count word frequencies
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  // Sort by frequency and return top keywords
  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Suggest tags based on article content
 */
export async function suggestTags(
  prisma: PrismaClient,
  articleId: string
): Promise<TagSuggestion[]> {
  const article = await prisma.contentArticle.findUnique({
    where: { id: articleId },
    include: {
      tags: {
        include: { tag: true },
      },
    },
  });

  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  // Extract keywords from title and body
  const text = `${article.title} ${extractTextFromHtml(article.body)}`;
  const keywords = extractKeywords(text);

  // Get existing tags
  const existingTagIds = new Set(article.tags.map((t) => t.tagId));

  // Find matching tags
  const allTags = await prisma.tag.findMany({
    where: {
      name: {
        in: keywords.map((k) => k.toLowerCase()),
      },
    },
  });

  const suggestions: TagSuggestion[] = [];

  for (const tag of allTags) {
    if (!existingTagIds.has(tag.id)) {
      const keyword = keywords.find((k) => k.toLowerCase() === tag.name.toLowerCase());
      if (keyword) {
        suggestions.push({
          tagId: tag.id,
          tagName: tag.name,
          confidence: 0.7, // Base confidence
          reason: `Keyword "${keyword}" found in content`,
        });
      }
    }
  }

  // Also suggest tags based on category similarity
  const categories = await prisma.contentArticleCategory.findMany({
    where: { articleId },
    include: { category: true },
  });

  for (const cat of categories) {
    // Find tags commonly associated with this category
    const categoryTags = await prisma.contentArticleTag.findMany({
      where: {
        article: {
          categories: {
            some: { categoryId: cat.categoryId },
          },
        },
      },
      include: { tag: true },
      take: 10,
    });

    const tagCounts = new Map<string, number>();
    for (const ct of categoryTags) {
      if (!existingTagIds.has(ct.tagId)) {
        tagCounts.set(ct.tagId, (tagCounts.get(ct.tagId) || 0) + 1);
      }
    }

    for (const [tagId, count] of tagCounts.entries()) {
      if (count >= 2) {
        const tag = await prisma.tag.findUnique({ where: { id: tagId } });
        if (tag) {
          suggestions.push({
            tagId: tag.id,
            tagName: tag.name,
            confidence: Math.min(0.5 + count * 0.1, 0.9),
            reason: `Commonly used with category "${cat.category.name}"`,
          });
        }
      }
    }
  }

  // Remove duplicates and sort by confidence
  const uniqueSuggestions = new Map<string, TagSuggestion>();
  for (const suggestion of suggestions) {
    const existing = uniqueSuggestions.get(suggestion.tagId);
    if (!existing || existing.confidence < suggestion.confidence) {
      uniqueSuggestions.set(suggestion.tagId, suggestion);
    }
  }

  return Array.from(uniqueSuggestions.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10); // Return top 10 suggestions
}

/**
 * Suggest categories based on article content
 */
export async function suggestCategories(
  prisma: PrismaClient,
  articleId: string
): Promise<CategorySuggestion[]> {
  const article = await prisma.contentArticle.findUnique({
    where: { id: articleId },
    include: {
      categories: {
        include: { category: true },
      },
    },
  });

  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  // Extract keywords
  const text = `${article.title} ${extractTextFromHtml(article.body)}`;
  const keywords = extractKeywords(text);

  // Get existing category IDs
  const existingCategoryIds = new Set(article.categories.map((c) => c.categoryId));

  // Find categories with matching names or descriptions
  const allCategories = await prisma.category.findMany({
    where: {
      OR: [
        {
          name: {
            in: keywords.map((k) => k.toLowerCase()),
          },
        },
        {
          description: {
            contains: keywords.join(' '),
            mode: 'insensitive',
          },
        },
      ],
    },
  });

  const suggestions: CategorySuggestion[] = [];

  for (const category of allCategories) {
    if (!existingCategoryIds.has(category.id)) {
      const keywordMatch = keywords.some((k) =>
        category.name.toLowerCase().includes(k.toLowerCase())
      );
      if (keywordMatch) {
        suggestions.push({
          categoryId: category.id,
          categoryName: category.name,
          confidence: 0.6,
          reason: `Keyword match with category name`,
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Apply suggested tags to article
 */
export async function applyTagSuggestions(
  prisma: PrismaClient,
  articleId: string,
  tagIds: string[]
): Promise<number> {
  let added = 0;

  for (const tagId of tagIds) {
    try {
      await prisma.contentArticleTag.create({
        data: {
          articleId,
          tagId,
        },
      });
      added++;
    } catch (error) {
      // Tag might already exist, ignore
      log.debug('Tag already exists or error adding tag', { articleId, tagId, error });
    }
  }

  log.info('Applied tag suggestions', { articleId, count: added });
  return added;
}

/**
 * Apply suggested categories to article
 */
export async function applyCategorySuggestions(
  prisma: PrismaClient,
  articleId: string,
  categoryIds: string[]
): Promise<number> {
  let added = 0;

  for (const categoryId of categoryIds) {
    try {
      await prisma.contentArticleCategory.create({
        data: {
          articleId,
          categoryId,
        },
      });
      added++;
    } catch (error) {
      // Category might already exist, ignore
      log.debug('Category already exists or error adding category', { articleId, categoryId, error });
    }
  }

  log.info('Applied category suggestions', { articleId, count: added });
  return added;
}

