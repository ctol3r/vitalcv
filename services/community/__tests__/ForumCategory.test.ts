/**
 * Tests for ForumCategory model
 */

import { PrismaClient } from '@prisma/client';
import {
  createForumCategory,
  getForumCategory,
  listForumCategories,
  updateForumCategory,
  deleteForumCategory,
} from '../models/ForumCategory.js';

describe('ForumCategory', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.forumCategory.deleteMany({});
  });

  describe('createForumCategory', () => {
    it('should create a category with required fields', async () => {
      const category = await createForumCategory(prisma, {
        name: 'General Discussion',
        description: 'General topics',
        visibility: 'public',
      });

      expect(category).toBeDefined();
      expect(category.name).toBe('General Discussion');
      expect(category.description).toBe('General topics');
      expect(category.visibility).toBe('public');
      expect(category.parentId).toBeNull();
    });

    it('should create a category with parent', async () => {
      const parent = await createForumCategory(prisma, {
        name: 'Parent Category',
        visibility: 'public',
      });

      const child = await createForumCategory(prisma, {
        name: 'Child Category',
        parentId: parent.id,
        visibility: 'public',
      });

      expect(child.parentId).toBe(parent.id);
    });

    it('should throw error if parent does not exist', async () => {
      await expect(
        createForumCategory(prisma, {
          name: 'Child Category',
          parentId: 'non-existent-id',
          visibility: 'public',
        })
      ).rejects.toThrow('Parent category non-existent-id not found');
    });
  });

  describe('getForumCategory', () => {
    it('should retrieve a category by ID', async () => {
      const created = await createForumCategory(prisma, {
        name: 'Test Category',
        visibility: 'public',
      });

      const retrieved = await getForumCategory(prisma, created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Category');
    });

    it('should return null for non-existent category', async () => {
      const retrieved = await getForumCategory(prisma, 'non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('listForumCategories', () => {
    it('should list all categories', async () => {
      await createForumCategory(prisma, {
        name: 'Category 1',
        visibility: 'public',
      });
      await createForumCategory(prisma, {
        name: 'Category 2',
        visibility: 'private',
      });

      const categories = await listForumCategories(prisma);
      expect(categories.length).toBe(2);
    });

    it('should filter by visibility', async () => {
      await createForumCategory(prisma, {
        name: 'Public Category',
        visibility: 'public',
      });
      await createForumCategory(prisma, {
        name: 'Private Category',
        visibility: 'private',
      });

      const publicCategories = await listForumCategories(prisma, {
        visibility: 'public',
      });
      expect(publicCategories.length).toBe(1);
      expect(publicCategories[0].visibility).toBe('public');
    });

    it('should filter by parentId', async () => {
      const parent = await createForumCategory(prisma, {
        name: 'Parent',
        visibility: 'public',
      });
      await createForumCategory(prisma, {
        name: 'Child 1',
        parentId: parent.id,
        visibility: 'public',
      });
      await createForumCategory(prisma, {
        name: 'Child 2',
        parentId: parent.id,
        visibility: 'public',
      });

      const children = await listForumCategories(prisma, {
        parentId: parent.id,
      });
      expect(children.length).toBe(2);
    });
  });

  describe('updateForumCategory', () => {
    it('should update category fields', async () => {
      const category = await createForumCategory(prisma, {
        name: 'Original Name',
        visibility: 'public',
      });

      const updated = await updateForumCategory(prisma, category.id, {
        name: 'Updated Name',
        description: 'New description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New description');
    });

    it('should throw error if category does not exist', async () => {
      await expect(
        updateForumCategory(prisma, 'non-existent-id', {
          name: 'New Name',
        })
      ).rejects.toThrow('Category non-existent-id not found');
    });

    it('should prevent category from being its own parent', async () => {
      const category = await createForumCategory(prisma, {
        name: 'Test Category',
        visibility: 'public',
      });

      await expect(
        updateForumCategory(prisma, category.id, {
          parentId: category.id,
        })
      ).rejects.toThrow('Category cannot be its own parent');
    });
  });

  describe('deleteForumCategory', () => {
    it('should delete a category without posts', async () => {
      const category = await createForumCategory(prisma, {
        name: 'To Delete',
        visibility: 'public',
      });

      await deleteForumCategory(prisma, category.id);

      const retrieved = await getForumCategory(prisma, category.id);
      expect(retrieved).toBeNull();
    });

    it('should throw error if category has posts', async () => {
      const category = await createForumCategory(prisma, {
        name: 'Category with Posts',
        visibility: 'public',
      });

      // Create a post in this category
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      await prisma.forumPost.create({
        data: {
          categoryId: category.id,
          authorId: user.id,
          title: 'Test Post',
          body: 'Test body',
        },
      });

      await expect(deleteForumCategory(prisma, category.id)).rejects.toThrow(
        'Cannot delete category'
      );
    });

    it('should throw error if category has children', async () => {
      const parent = await createForumCategory(prisma, {
        name: 'Parent',
        visibility: 'public',
      });

      await createForumCategory(prisma, {
        name: 'Child',
        parentId: parent.id,
        visibility: 'public',
      });

      await expect(deleteForumCategory(prisma, parent.id)).rejects.toThrow(
        'Cannot delete category'
      );
    });
  });
});

