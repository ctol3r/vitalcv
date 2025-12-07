/**
 * Tests for ForumPost model
 */

import { PrismaClient } from '@prisma/client';
import {
  createForumPost,
  getForumPost,
  listForumPosts,
  updateForumPost,
  softDeleteForumPost,
  restoreForumPost,
  lockForumPost,
  pinForumPost,
} from '../models/ForumPost.js';

describe('ForumPost', () => {
  let prisma: PrismaClient;
  let testUser: { id: string };
  let testCategory: { id: string };

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.forumComment.deleteMany({});
    await prisma.forumPost.deleteMany({});
    await prisma.forumCategory.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
      },
    });

    // Create test category
    testCategory = await prisma.forumCategory.create({
      data: {
        name: 'Test Category',
        visibility: 'public',
      },
    });
  });

  describe('createForumPost', () => {
    it('should create a post with required fields', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Test Post',
        body: 'Test body content',
      });

      expect(post).toBeDefined();
      expect(post.title).toBe('Test Post');
      expect(post.body).toBe('Test body content');
      expect(post.status).toBe('active');
      expect(post.tags).toEqual([]);
    });

    it('should create a post with tags', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Tagged Post',
        body: 'Body',
        tags: ['tag1', 'tag2'],
      });

      expect(post.tags).toEqual(['tag1', 'tag2']);
    });

    it('should throw error if category does not exist', async () => {
      await expect(
        createForumPost(prisma, {
          categoryId: 'non-existent-id',
          authorId: testUser.id,
          title: 'Test',
          body: 'Body',
        })
      ).rejects.toThrow('Category non-existent-id not found');
    });

    it('should throw error if author does not exist', async () => {
      await expect(
        createForumPost(prisma, {
          categoryId: testCategory.id,
          authorId: 'non-existent-id',
          title: 'Test',
          body: 'Body',
        })
      ).rejects.toThrow('Author non-existent-id not found');
    });
  });

  describe('getForumPost', () => {
    it('should retrieve a post by ID', async () => {
      const created = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Test Post',
        body: 'Body',
      });

      const retrieved = await getForumPost(prisma, created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should exclude soft-deleted posts by default', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Test Post',
        body: 'Body',
      });

      await softDeleteForumPost(prisma, post.id);

      const retrieved = await getForumPost(prisma, post.id);
      expect(retrieved).toBeNull();
    });

    it('should include soft-deleted posts when requested', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Test Post',
        body: 'Body',
      });

      await softDeleteForumPost(prisma, post.id);

      const retrieved = await getForumPost(prisma, post.id, true);
      expect(retrieved).toBeDefined();
      expect(retrieved?.deletedAt).not.toBeNull();
    });
  });

  describe('listForumPosts', () => {
    it('should list posts', async () => {
      await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Post 1',
        body: 'Body 1',
      });
      await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Post 2',
        body: 'Body 2',
      });

      const posts = await listForumPosts(prisma);
      expect(posts.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by category', async () => {
      const category2 = await prisma.forumCategory.create({
        data: {
          name: 'Category 2',
          visibility: 'public',
        },
      });

      await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Post 1',
        body: 'Body',
      });
      await createForumPost(prisma, {
        categoryId: category2.id,
        authorId: testUser.id,
        title: 'Post 2',
        body: 'Body',
      });

      const posts = await listForumPosts(prisma, {
        categoryId: testCategory.id,
      });
      expect(posts.length).toBe(1);
      expect(posts[0].categoryId).toBe(testCategory.id);
    });

    it('should filter by tags', async () => {
      await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Post 1',
        body: 'Body',
        tags: ['tag1', 'tag2'],
      });
      await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Post 2',
        body: 'Body',
        tags: ['tag2', 'tag3'],
      });

      const posts = await listForumPosts(prisma, {
        tags: ['tag1'],
      });
      expect(posts.length).toBe(1);
      expect(posts[0].tags).toContain('tag1');
    });
  });

  describe('softDeleteForumPost', () => {
    it('should soft delete a post', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'To Delete',
        body: 'Body',
      });

      const deleted = await softDeleteForumPost(prisma, post.id);
      expect(deleted.deletedAt).not.toBeNull();
    });

    it('should throw error if post is already deleted', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'To Delete',
        body: 'Body',
      });

      await softDeleteForumPost(prisma, post.id);
      await expect(softDeleteForumPost(prisma, post.id)).rejects.toThrow(
        'already deleted'
      );
    });
  });

  describe('restoreForumPost', () => {
    it('should restore a deleted post', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'To Restore',
        body: 'Body',
      });

      await softDeleteForumPost(prisma, post.id);
      const restored = await restoreForumPost(prisma, post.id);
      expect(restored.deletedAt).toBeNull();
    });
  });

  describe('lockForumPost', () => {
    it('should lock a post', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'To Lock',
        body: 'Body',
      });

      const locked = await lockForumPost(prisma, post.id);
      expect(locked.status).toBe('locked');
    });
  });

  describe('pinForumPost', () => {
    it('should pin a post', async () => {
      const post = await createForumPost(prisma, {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'To Pin',
        body: 'Body',
      });

      const pinned = await pinForumPost(prisma, post.id);
      expect(pinned.status).toBe('pinned');
    });
  });
});

