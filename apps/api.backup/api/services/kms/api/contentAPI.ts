/**
 * B243A-KMS-008: ContentAPI
 *
 * Exposes REST endpoints for articles: list, get by slug, search, create, update, delete
 * Includes filter by status, category, tags
 * Enforces RBAC
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, ContentArticleStatus } from '@prisma/client';
import { ContentArticleService } from '../models/ContentArticle';
import { CategoryService } from '../models/Category';
import { TagService } from '../models/Tag';
import { ContentAuthorService } from '../models/ContentAuthor';
import { ContentVersionService } from '../models/ContentVersion';
import { ContentWorkflowService } from '../services/contentWorkflowService';
import { SearchIndexService } from '../services/searchIndexService';
import { AuthRequest } from '../../../backend/src/middlewares/guards';

/**
 * Create Content API router
 */
export function createContentAPIRouter(prisma: PrismaClient): Router {
  const router = Router();
  const articleService = new ContentArticleService(prisma);
  const categoryService = new CategoryService(prisma);
  const tagService = new TagService(prisma);
  const authorService = new ContentAuthorService(prisma);
  const versionService = new ContentVersionService(prisma);
  const workflowService = new ContentWorkflowService(prisma);
  const searchService = new SearchIndexService(prisma);

  /**
   * GET /articles - List articles with filters
   */
  router.get('/articles', async (req: Request, res: Response) => {
    try {
      const {
        status,
        authorId,
        categoryId,
        tagId,
        page = '1',
        limit = '20',
      } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const articles = await articleService.listArticles({
        status: status as ContentArticleStatus | undefined,
        authorId: authorId as string | undefined,
        categoryId: categoryId as string | undefined,
        tagId: tagId as string | undefined,
        skip,
        take,
      });

      res.json({
        articles,
        pagination: {
          page: parseInt(page as string),
          limit: take,
          total: articles.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /articles/:slug - Get article by slug
   */
  router.get('/articles/:slug', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const article = await articleService.getArticleBySlug(slug);

      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      res.json(article);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /articles/search - Search articles
   */
  router.get('/articles/search', async (req: Request, res: Response) => {
    try {
      const {
        q,
        status,
        categoryIds,
        tagIds,
        authorId,
        publishedAfter,
        publishedBefore,
        limit = '50',
        offset = '0',
      } = req.query;

      const results = await searchService.search({
        query: q as string | undefined,
        status: status as ContentArticleStatus | undefined,
        categoryIds: categoryIds
          ? (categoryIds as string).split(',')
          : undefined,
        tagIds: tagIds ? (tagIds as string).split(',') : undefined,
        authorId: authorId as string | undefined,
        publishedAfter: publishedAfter
          ? new Date(publishedAfter as string)
          : undefined,
        publishedBefore: publishedBefore
          ? new Date(publishedBefore as string)
          : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.json({
        results,
        count: results.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /articles - Create article (requires auth)
   */
  router.post('/articles', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const {
        title,
        slug,
        body,
        summary,
        authorId,
        categoryIds = [],
        tagIds = [],
      } = req.body;

      if (!title || !slug || !body || !authorId) {
        return res.status(400).json({
          error: 'Missing required fields: title, slug, body, authorId',
        });
      }

      const article = await articleService.createArticle({
        title,
        slug,
        body,
        summary,
        authorId,
        categoryIds,
        tagIds,
        status: ContentArticleStatus.DRAFT,
      });

      res.status(201).json(article);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /articles/:id - Update article (requires auth)
   */
  router.put('/articles/:id', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const updateData = req.body;

      const article = await articleService.updateArticle(id, updateData);

      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      res.json(article);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /articles/:id - Delete article (requires auth + editor/admin)
   */
  router.delete('/articles/:id', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission =
        req.user.roles.includes('admin') || req.user.roles.includes('editor');

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const deleted = await articleService.deleteArticle(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Article not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /articles/:id/submit - Submit for review
   */
  router.post('/articles/:id/submit', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const result = await workflowService.submitForReview(
        id,
        req.user.id,
        req.user.roles
      );

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json({ success: true, message: result.message });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /articles/:id/publish - Approve and publish (requires admin/publisher)
   */
  router.post('/articles/:id/publish', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission =
        req.user.roles.includes('admin') || req.user.roles.includes('publisher');

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const result = await workflowService.approveAndPublish(
        id,
        req.user.id,
        req.user.roles
      );

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json({ success: true, message: result.message });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /articles/:id/reject - Reject article (requires editor/admin)
   */
  router.post('/articles/:id/reject', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission =
        req.user.roles.includes('admin') || req.user.roles.includes('editor');

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const result = await workflowService.rejectArticle(
        id,
        req.user.id,
        req.user.roles,
        reason || 'No reason provided'
      );

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json({ success: true, message: result.message });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /categories - List categories
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const { includeChildren = 'false' } = req.query;
      const categories = await categoryService.listCategories(
        includeChildren === 'true'
      );
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /tags - List tags
   */
  router.get('/tags', async (req: Request, res: Response) => {
    try {
      const tags = await tagService.listTags();
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /authors - List authors
   */
  router.get('/authors', async (req: Request, res: Response) => {
    try {
      const authors = await authorService.listAuthors();
      res.json(authors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /articles/:id/versions - Get version history
   */
  router.get('/articles/:id/versions', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const versions = await versionService.getVersionHistory(id);
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

