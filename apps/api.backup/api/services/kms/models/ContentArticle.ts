/**
 * B243A-KMS-001: ContentArticle model
 *
 * Represents a content article with title, slug, body (HTML/Markdown), summary,
 * status (draft/published/archived), authorId, categoryIds (array), tagIds (array),
 * publishDate, createdAt, updatedAt
 */

import {
  PrismaClient,
  ContentArticle as PrismaContentArticle,
  ContentArticleStatus,
} from '@prisma/client';

export interface ContentArticleInput {
  title: string;
  slug: string;
  body: string; // HTML/Markdown content
  summary?: string;
  status?: ContentArticleStatus;
  authorId: string;
  categoryIds?: string[];
  tagIds?: string[];
  publishDate?: Date;
}

export interface ContentArticleOutput {
  id: string;
  title: string;
  slug: string;
  body: string;
  summary: string | null;
  status: ContentArticleStatus;
  authorId: string;
  categoryIds: string[];
  tagIds: string[];
  publishDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ContentArticleService
 *
 * Manages content articles with categories and tags
 */
export class ContentArticleService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new content article
   */
  async createArticle(input: ContentArticleInput): Promise<ContentArticleOutput> {
    const { categoryIds = [], tagIds = [], ...articleData } = input;

    const article = await this.prisma.contentArticle.create({
      data: {
        ...articleData,
        status: input.status ?? ContentArticleStatus.DRAFT,
        categories: {
          create: categoryIds.map((categoryId) => ({
            category: { connect: { id: categoryId } },
          })),
        },
        tags: {
          create: tagIds.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
      include: {
        categories: true,
        tags: true,
      },
    });

    return this.mapToOutput(article);
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: string): Promise<ContentArticleOutput | null> {
    const article = await this.prisma.contentArticle.findUnique({
      where: { id },
      include: {
        categories: true,
        tags: true,
      },
    });

    return article ? this.mapToOutput(article) : null;
  }

  /**
   * Get article by slug
   */
  async getArticleBySlug(slug: string): Promise<ContentArticleOutput | null> {
    const article = await this.prisma.contentArticle.findUnique({
      where: { slug },
      include: {
        categories: true,
        tags: true,
      },
    });

    return article ? this.mapToOutput(article) : null;
  }

  /**
   * Update article
   */
  async updateArticle(
    id: string,
    input: Partial<ContentArticleInput>
  ): Promise<ContentArticleOutput> {
    const { categoryIds, tagIds, ...updateData } = input;

    // Handle category and tag updates
    const updatePayload: any = { ...updateData };

    if (categoryIds !== undefined) {
      // Delete existing categories
      await this.prisma.contentArticleCategory.deleteMany({
        where: { articleId: id },
      });
      // Create new category associations
      updatePayload.categories = {
        create: categoryIds.map((categoryId) => ({
          category: { connect: { id: categoryId } },
        })),
      };
    }

    if (tagIds !== undefined) {
      // Delete existing tags
      await this.prisma.contentArticleTag.deleteMany({
        where: { articleId: id },
      });
      // Create new tag associations
      updatePayload.tags = {
        create: tagIds.map((tagId) => ({
          tag: { connect: { id: tagId } },
        })),
      };
    }

    const article = await this.prisma.contentArticle.update({
      where: { id },
      data: updatePayload,
      include: {
        categories: true,
        tags: true,
      },
    });

    return this.mapToOutput(article);
  }

  /**
   * Delete article
   */
  async deleteArticle(id: string): Promise<boolean> {
    try {
      await this.prisma.contentArticle.delete({
        where: { id },
      });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List articles with filters
   */
  async listArticles(options: {
    status?: ContentArticleStatus;
    authorId?: string;
    categoryId?: string;
    tagId?: string;
    skip?: number;
    take?: number;
  }): Promise<ContentArticleOutput[]> {
    const { status, authorId, categoryId, tagId, skip = 0, take = 100 } = options;

    const where: any = {};
    if (status) where.status = status;
    if (authorId) where.authorId = authorId;
    if (categoryId) {
      where.categories = {
        some: { categoryId },
      };
    }
    if (tagId) {
      where.tags = {
        some: { tagId },
      };
    }

    const articles = await this.prisma.contentArticle.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        categories: true,
        tags: true,
      },
    });

    return articles.map((a) => this.mapToOutput(a));
  }

  /**
   * Search articles by title or body
   */
  async searchArticles(query: string, limit: number = 50): Promise<ContentArticleOutput[]> {
    const articles = await this.prisma.contentArticle.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        categories: true,
        tags: true,
      },
    });

    return articles.map((a) => this.mapToOutput(a));
  }

  private mapToOutput(
    article: PrismaContentArticle & {
      categories?: Array<{ categoryId: string }>;
      tags?: Array<{ tagId: string }>;
    }
  ): ContentArticleOutput {
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      body: article.body,
      summary: article.summary,
      status: article.status,
      authorId: article.authorId,
      categoryIds: article.categories?.map((c) => c.categoryId) || [],
      tagIds: article.tags?.map((t) => t.tagId) || [],
      publishDate: article.publishDate,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }
}

