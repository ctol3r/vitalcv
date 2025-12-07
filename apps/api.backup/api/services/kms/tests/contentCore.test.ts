/**
 * B243A-KMS-010: ContentCoreTests
 *
 * Unit tests covering models (articles, categories, tags, versions),
 * service methods (workflow, search)
 * Ensures creation, versioning, and search produce expected results
 */

import { PrismaClient, ContentArticleStatus } from '@prisma/client';
import { ContentArticleService } from '../models/ContentArticle';
import { CategoryService } from '../models/Category';
import { TagService } from '../models/Tag';
import { ContentAuthorService } from '../models/ContentAuthor';
import { ContentVersionService } from '../models/ContentVersion';
import { ContentWorkflowService } from '../services/contentWorkflowService';
import { SearchIndexService } from '../services/searchIndexService';

describe('KMS Content Core Tests', () => {
  let prisma: PrismaClient;
  let articleService: ContentArticleService;
  let categoryService: CategoryService;
  let tagService: TagService;
  let authorService: ContentAuthorService;
  let versionService: ContentVersionService;
  let workflowService: ContentWorkflowService;
  let searchService: SearchIndexService;

  let testAuthorId: string;
  let testCategoryId: string;
  let testTagId: string;
  let testArticleId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    articleService = new ContentArticleService(prisma);
    categoryService = new CategoryService(prisma);
    tagService = new TagService(prisma);
    authorService = new ContentAuthorService(prisma);
    versionService = new ContentVersionService(prisma);
    workflowService = new ContentWorkflowService(prisma);
    searchService = new SearchIndexService(prisma);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testArticleId) {
      await articleService.deleteArticle(testArticleId);
    }
    if (testCategoryId) {
      await categoryService.deleteCategory(testCategoryId, false);
    }
    if (testTagId) {
      await tagService.deleteTag(testTagId);
    }
    if (testAuthorId) {
      await authorService.deleteAuthor(testAuthorId);
    }
    await prisma.$disconnect();
  });

  describe('ContentAuthor Model', () => {
    test('should create an author', async () => {
      const author = await authorService.createAuthor({
        name: 'Test Author',
        bio: 'Test bio',
      });

      expect(author).toBeDefined();
      expect(author.name).toBe('Test Author');
      expect(author.bio).toBe('Test bio');
      testAuthorId = author.id;
    });

    test('should get author by ID', async () => {
      const author = await authorService.getAuthorById(testAuthorId);
      expect(author).toBeDefined();
      expect(author?.id).toBe(testAuthorId);
    });

    test('should update author', async () => {
      const updated = await authorService.updateAuthor(testAuthorId, {
        bio: 'Updated bio',
      });
      expect(updated.bio).toBe('Updated bio');
    });
  });

  describe('Category Model', () => {
    test('should create a category', async () => {
      const category = await categoryService.createCategory({
        name: 'Test Category',
        description: 'Test description',
      });

      expect(category).toBeDefined();
      expect(category.name).toBe('Test Category');
      testCategoryId = category.id;
    });

    test('should create nested category', async () => {
      const child = await categoryService.createCategory({
        name: 'Child Category',
        parentId: testCategoryId,
      });

      expect(child).toBeDefined();
      expect(child.parentId).toBe(testCategoryId);

      // Cleanup
      await categoryService.deleteCategory(child.id, false);
    });

    test('should get category by ID', async () => {
      const category = await categoryService.getCategoryById(testCategoryId);
      expect(category).toBeDefined();
      expect(category?.id).toBe(testCategoryId);
    });
  });

  describe('Tag Model', () => {
    test('should create a tag', async () => {
      const tag = await tagService.createTag({
        name: 'test-tag',
        description: 'Test tag description',
      });

      expect(tag).toBeDefined();
      expect(tag.name).toBe('test-tag');
      testTagId = tag.id;
    });

    test('should get tag by name', async () => {
      const tag = await tagService.getTagByName('test-tag');
      expect(tag).toBeDefined();
      expect(tag?.id).toBe(testTagId);
    });

    test('should search tags', async () => {
      const results = await tagService.searchTags('test');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((t) => t.id === testTagId)).toBe(true);
    });
  });

  describe('ContentArticle Model', () => {
    test('should create an article', async () => {
      const article = await articleService.createArticle({
        title: 'Test Article',
        slug: 'test-article',
        body: 'Test article body content',
        summary: 'Test summary',
        authorId: testAuthorId,
        categoryIds: [testCategoryId],
        tagIds: [testTagId],
        status: ContentArticleStatus.DRAFT,
      });

      expect(article).toBeDefined();
      expect(article.title).toBe('Test Article');
      expect(article.slug).toBe('test-article');
      expect(article.status).toBe(ContentArticleStatus.DRAFT);
      expect(article.categoryIds).toContain(testCategoryId);
      expect(article.tagIds).toContain(testTagId);
      testArticleId = article.id;
    });

    test('should get article by slug', async () => {
      const article = await articleService.getArticleBySlug('test-article');
      expect(article).toBeDefined();
      expect(article?.id).toBe(testArticleId);
    });

    test('should update article', async () => {
      const updated = await articleService.updateArticle(testArticleId, {
        title: 'Updated Title',
      });
      expect(updated.title).toBe('Updated Title');
    });

    test('should list articles with filters', async () => {
      const articles = await articleService.listArticles({
        status: ContentArticleStatus.DRAFT,
      });
      expect(articles.length).toBeGreaterThan(0);
      expect(articles.some((a) => a.id === testArticleId)).toBe(true);
    });

    test('should search articles', async () => {
      const results = await articleService.searchArticles('Test');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((a) => a.id === testArticleId)).toBe(true);
    });
  });

  describe('ContentVersion Model & Service', () => {
    test('should create a version', async () => {
      const version = await versionService.createVersion({
        articleId: testArticleId,
        content: 'Version 1 content',
        editorId: 'editor-1',
      });

      expect(version).toBeDefined();
      expect(version.versionNumber).toBe(1);
      expect(version.content).toBe('Version 1 content');
    });

    test('should create multiple versions', async () => {
      const v2 = await versionService.createVersion({
        articleId: testArticleId,
        content: 'Version 2 content',
        editorId: 'editor-2',
      });

      expect(v2.versionNumber).toBe(2);

      const v3 = await versionService.createVersion({
        articleId: testArticleId,
        content: 'Version 3 content',
        editorId: 'editor-1',
      });

      expect(v3.versionNumber).toBe(3);
    });

    test('should get version history', async () => {
      const history = await versionService.getVersionHistory(testArticleId);
      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history[0].versionNumber).toBeGreaterThan(history[1].versionNumber); // Descending order
    });

    test('should get latest version', async () => {
      const latest = await versionService.getLatestVersion(testArticleId);
      expect(latest).toBeDefined();
      expect(latest?.versionNumber).toBeGreaterThanOrEqual(3);
    });

    test('should compare versions', async () => {
      const comparison = await versionService.compareVersions(
        testArticleId,
        1,
        2
      );
      expect(comparison).toBeDefined();
      expect(comparison?.version1.versionNumber).toBe(1);
      expect(comparison?.version2.versionNumber).toBe(2);
      expect(comparison?.differences.length).toBeGreaterThan(0);
    });
  });

  describe('ContentWorkflowService', () => {
    test('should submit article for review', async () => {
      const result = await workflowService.submitForReview(
        testArticleId,
        'user-1',
        ['editor']
      );

      expect(result.success).toBe(true);

      const article = await articleService.getArticleById(testArticleId);
      expect(article?.status).toBe(ContentArticleStatus.REVIEW);
    });

    test('should reject article (send back to draft)', async () => {
      const result = await workflowService.rejectArticle(
        testArticleId,
        'user-1',
        ['editor'],
        'Needs more content'
      );

      expect(result.success).toBe(true);

      const article = await articleService.getArticleById(testArticleId);
      expect(article?.status).toBe(ContentArticleStatus.DRAFT);
    });

    test('should approve and publish article', async () => {
      // First submit for review
      await workflowService.submitForReview(testArticleId, 'user-1', ['editor']);

      // Then approve
      const result = await workflowService.approveAndPublish(
        testArticleId,
        'user-2',
        ['admin']
      );

      expect(result.success).toBe(true);

      const article = await articleService.getArticleById(testArticleId);
      expect(article?.status).toBe(ContentArticleStatus.PUBLISHED);
      expect(article?.publishDate).toBeDefined();
    });

    test('should enforce role-based permissions', async () => {
      // Try to publish without proper role
      const result = await workflowService.approveAndPublish(
        testArticleId,
        'user-3',
        ['user'] // Not admin or publisher
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('required role');
    });

    test('should get available transitions', async () => {
      const transitions = await workflowService.getAvailableTransitions(
        testArticleId,
        ['admin']
      );

      expect(transitions).toContain(ContentArticleStatus.ARCHIVED);
    });
  });

  describe('SearchIndexService', () => {
    test('should build search index', async () => {
      await searchService.buildIndex();
      const stats = searchService.getIndexStats();
      expect(stats.indexedArticles).toBeGreaterThan(0);
    });

    test('should search articles by query', async () => {
      const results = await searchService.search({
        query: 'Test',
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.article.id === testArticleId)).toBe(true);
    });

    test('should filter by status', async () => {
      const results = await searchService.search({
        status: ContentArticleStatus.PUBLISHED,
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.every((r) => r.article.status === ContentArticleStatus.PUBLISHED)
      ).toBe(true);
    });

    test('should filter by category', async () => {
      const results = await searchService.search({
        categoryIds: [testCategoryId],
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some((r) => r.article.categoryIds.includes(testCategoryId))
      ).toBe(true);
    });

    test('should return search scores', async () => {
      const results = await searchService.search({
        query: 'Test Article',
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].matchedFields.length).toBeGreaterThan(0);
    });
  });
});

