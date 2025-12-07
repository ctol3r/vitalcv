/**
 * B243A-KMS-007: SearchIndexService
 *
 * Builds search index for articles (using in-memory index for simplicity).
 * Indexes articles by title, body, tags, categories.
 * Supports full-text search and filtering.
 */

import { PrismaClient, ContentArticleStatus } from '@prisma/client';
import { ContentArticleService } from '../models/ContentArticle';
import { ContentArticleOutput } from '../models/ContentArticle';

export interface SearchIndexEntry {
  articleId: string;
  title: string;
  body: string;
  summary: string | null;
  tags: string[];
  categories: string[];
  status: ContentArticleStatus;
  publishDate: Date | null;
}

export interface SearchQuery {
  query?: string;
  status?: ContentArticleStatus;
  categoryIds?: string[];
  tagIds?: string[];
  authorId?: string;
  publishedAfter?: Date;
  publishedBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  article: ContentArticleOutput;
  score: number;
  matchedFields: string[];
}

/**
 * SearchIndexService
 *
 * Provides full-text search and filtering for articles
 */
export class SearchIndexService {
  private index: Map<string, SearchIndexEntry> = new Map();
  private articleService: ContentArticleService;
  private isIndexed: boolean = false;

  constructor(private prisma: PrismaClient) {
    this.articleService = new ContentArticleService(prisma);
  }

  /**
   * Build or rebuild the search index
   */
  async buildIndex(): Promise<void> {
    this.index.clear();
    const articles = await this.articleService.listArticles({ take: 10000 });

    for (const article of articles) {
      // Fetch full article with relations
      const fullArticle = await this.articleService.getArticleById(article.id);
      if (!fullArticle) continue;

      // Get category and tag names
      const categories = await Promise.all(
        article.categoryIds.map(async (id) => {
          const cat = await this.prisma.category.findUnique({ where: { id } });
          return cat?.name || '';
        })
      );

      const tags = await Promise.all(
        article.tagIds.map(async (id) => {
          const tag = await this.prisma.tag.findUnique({ where: { id } });
          return tag?.name || '';
        })
      );

      this.index.set(article.id, {
        articleId: article.id,
        title: article.title,
        body: article.body,
        summary: article.summary || '',
        tags: tags.filter(Boolean),
        categories: categories.filter(Boolean),
        status: article.status,
        publishDate: article.publishDate,
      });
    }

    this.isIndexed = true;
  }

  /**
   * Search articles with query and filters
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isIndexed) {
      await this.buildIndex();
    }

    const {
      query: searchQuery,
      status,
      categoryIds,
      tagIds,
      authorId,
      publishedAfter,
      publishedBefore,
      limit = 50,
      offset = 0,
    } = query;

    let results: SearchResult[] = [];

    // Filter by status
    let entries = Array.from(this.index.values());
    if (status) {
      entries = entries.filter((e) => e.status === status);
    }

    // Filter by author
    if (authorId) {
      const authorArticles = await this.articleService.listArticles({ authorId });
      const authorArticleIds = new Set(authorArticles.map((a) => a.id));
      entries = entries.filter((e) => authorArticleIds.has(e.articleId));
    }

    // Filter by categories
    if (categoryIds && categoryIds.length > 0) {
      const categoryArticles = await this.articleService.listArticles({ categoryId: categoryIds[0] });
      const categoryArticleIds = new Set(categoryArticles.map((a) => a.id));
      entries = entries.filter((e) => categoryArticleIds.has(e.articleId));
    }

    // Filter by tags
    if (tagIds && tagIds.length > 0) {
      const tagArticles = await this.articleService.listArticles({ tagId: tagIds[0] });
      const tagArticleIds = new Set(tagArticles.map((a) => a.id));
      entries = entries.filter((e) => tagArticleIds.has(e.articleId));
    }

    // Filter by publish date
    if (publishedAfter) {
      entries = entries.filter(
        (e) => e.publishDate && e.publishDate >= publishedAfter
      );
    }
    if (publishedBefore) {
      entries = entries.filter(
        (e) => e.publishDate && e.publishDate <= publishedBefore
      );
    }

    // Full-text search
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 0);

      for (const entry of entries) {
        const matchedFields: string[] = [];
        let score = 0;

        // Check title (highest weight)
        const titleLower = entry.title.toLowerCase();
        if (titleLower.includes(queryLower)) {
          matchedFields.push('title');
          score += 10;
          // Bonus for exact match
          if (titleLower === queryLower) score += 5;
        } else {
          // Check for individual terms in title
          for (const term of queryTerms) {
            if (titleLower.includes(term)) {
              matchedFields.push('title');
              score += 3;
            }
          }
        }

        // Check summary (medium weight)
        if (entry.summary) {
          const summaryLower = entry.summary.toLowerCase();
          if (summaryLower.includes(queryLower)) {
            matchedFields.push('summary');
            score += 5;
          } else {
            for (const term of queryTerms) {
              if (summaryLower.includes(term)) {
                matchedFields.push('summary');
                score += 2;
              }
            }
          }
        }

        // Check body (lower weight)
        const bodyLower = entry.body.toLowerCase();
        for (const term of queryTerms) {
          const matches = (bodyLower.match(new RegExp(term, 'g')) || []).length;
          if (matches > 0) {
            matchedFields.push('body');
            score += Math.min(matches, 5); // Cap body matches
          }
        }

        // Check tags
        for (const tag of entry.tags) {
          if (tag.toLowerCase().includes(queryLower)) {
            matchedFields.push('tags');
            score += 4;
          }
        }

        // Check categories
        for (const category of entry.categories) {
          if (category.toLowerCase().includes(queryLower)) {
            matchedFields.push('categories');
            score += 3;
          }
        }

        if (score > 0) {
          const article = await this.articleService.getArticleById(entry.articleId);
          if (article) {
            results.push({
              article,
              score,
              matchedFields: [...new Set(matchedFields)],
            });
          }
        }
      }

      // Sort by score (descending)
      results.sort((a, b) => b.score - a.score);
    } else {
      // No search query, just return filtered results
      for (const entry of entries) {
        const article = await this.articleService.getArticleById(entry.articleId);
        if (article) {
          results.push({
            article,
            score: 1,
            matchedFields: [],
          });
        }
      }
    }

    // Apply pagination
    return results.slice(offset, offset + limit);
  }

  /**
   * Get index statistics
   */
  getIndexStats(): { totalArticles: number; indexedArticles: number } {
    return {
      totalArticles: this.index.size,
      indexedArticles: this.index.size,
    };
  }

  /**
   * Clear the index
   */
  clearIndex(): void {
    this.index.clear();
    this.isIndexed = false;
  }
}

