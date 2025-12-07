/**
 * Tests for ForumComment model
 */

import { PrismaClient } from '@prisma/client';
import {
  createForumComment,
  getForumComment,
  listForumComments,
  updateForumComment,
  softDeleteForumComment,
  restoreForumComment,
  getCommentReplies,
} from '../models/ForumComment.js';

describe('ForumComment', () => {
  let prisma: PrismaClient;
  let testUser: { id: string };
  let testCategory: { id: string };
  let testPost: { id: string };

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

    // Create test post
    testPost = await prisma.forumPost.create({
      data: {
        categoryId: testCategory.id,
        authorId: testUser.id,
        title: 'Test Post',
        body: 'Test body',
      },
    });
  });

  describe('createForumComment', () => {
    it('should create a comment with required fields', async () => {
      const comment = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Test comment',
      });

      expect(comment).toBeDefined();
      expect(comment.body).toBe('Test comment');
      expect(comment.postId).toBe(testPost.id);
      expect(comment.authorId).toBe(testUser.id);
      expect(comment.parentCommentId).toBeNull();
    });

    it('should create a threaded reply', async () => {
      const parent = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Parent comment',
      });

      const reply = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Reply comment',
        parentCommentId: parent.id,
      });

      expect(reply.parentCommentId).toBe(parent.id);
    });

    it('should throw error if post does not exist', async () => {
      await expect(
        createForumComment(prisma, {
          postId: 'non-existent-id',
          authorId: testUser.id,
          body: 'Comment',
        })
      ).rejects.toThrow('Post non-existent-id not found');
    });

    it('should throw error if post is locked', async () => {
      const lockedPost = await prisma.forumPost.create({
        data: {
          categoryId: testCategory.id,
          authorId: testUser.id,
          title: 'Locked Post',
          body: 'Body',
          status: 'locked',
        },
      });

      await expect(
        createForumComment(prisma, {
          postId: lockedPost.id,
          authorId: testUser.id,
          body: 'Comment',
        })
      ).rejects.toThrow('is locked');
    });

    it('should throw error if parent comment does not exist', async () => {
      await expect(
        createForumComment(prisma, {
          postId: testPost.id,
          authorId: testUser.id,
          body: 'Reply',
          parentCommentId: 'non-existent-id',
        })
      ).rejects.toThrow('Parent comment non-existent-id not found');
    });
  });

  describe('getForumComment', () => {
    it('should retrieve a comment by ID', async () => {
      const created = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Test comment',
      });

      const retrieved = await getForumComment(prisma, created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should exclude soft-deleted comments by default', async () => {
      const comment = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'To delete',
      });

      await softDeleteForumComment(prisma, comment.id);

      const retrieved = await getForumComment(prisma, comment.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('listForumComments', () => {
    it('should list comments for a post', async () => {
      await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Comment 1',
      });
      await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Comment 2',
      });

      const comments = await listForumComments(prisma, {
        postId: testPost.id,
      });
      expect(comments.length).toBe(2);
    });

    it('should filter by parent comment', async () => {
      const parent = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Parent',
      });

      await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Reply 1',
        parentCommentId: parent.id,
      });
      await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Reply 2',
        parentCommentId: parent.id,
      });

      const replies = await listForumComments(prisma, {
        postId: testPost.id,
        parentCommentId: parent.id,
      });
      expect(replies.length).toBe(2);
    });
  });

  describe('getCommentReplies', () => {
    it('should get replies to a comment', async () => {
      const parent = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Parent',
      });

      await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Reply',
        parentCommentId: parent.id,
      });

      const replies = await getCommentReplies(prisma, parent.id);
      expect(replies.length).toBe(1);
      expect(replies[0].parentCommentId).toBe(parent.id);
    });
  });

  describe('updateForumComment', () => {
    it('should update comment body', async () => {
      const comment = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'Original',
      });

      const updated = await updateForumComment(prisma, comment.id, {
        body: 'Updated',
      });

      expect(updated.body).toBe('Updated');
    });
  });

  describe('softDeleteForumComment', () => {
    it('should soft delete a comment', async () => {
      const comment = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'To delete',
      });

      const deleted = await softDeleteForumComment(prisma, comment.id);
      expect(deleted.deletedAt).not.toBeNull();
    });
  });

  describe('restoreForumComment', () => {
    it('should restore a deleted comment', async () => {
      const comment = await createForumComment(prisma, {
        postId: testPost.id,
        authorId: testUser.id,
        body: 'To restore',
      });

      await softDeleteForumComment(prisma, comment.id);
      const restored = await restoreForumComment(prisma, comment.id);
      expect(restored.deletedAt).toBeNull();
    });
  });
});

