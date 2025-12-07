/**
 * B234A-COMM-001: ForumCategory Model
 *
 * Model for forum categories with hierarchical support and visibility controls.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export type CategoryVisibility = 'public' | 'private';

export interface ForumCategoryInput {
  name: string;
  description?: string;
  parentId?: string | null;
  visibility?: CategoryVisibility;
}

export interface ForumCategory {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  visibility: CategoryVisibility;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate category visibility
 */
export function validateVisibility(visibility: string): CategoryVisibility {
  if (visibility !== 'public' && visibility !== 'private') {
    throw new Error(`Invalid visibility: ${visibility}. Must be 'public' or 'private'`);
  }
  return visibility as CategoryVisibility;
}

/**
 * Create a new forum category
 */
export async function createForumCategory(
  prisma: PrismaClient,
  input: ForumCategoryInput
): Promise<ForumCategory> {
  // Validate parent exists if provided
  if (input.parentId) {
    const parent = await prisma.forumCategory.findUnique({
      where: { id: input.parentId },
    });
    if (!parent) {
      throw new Error(`Parent category ${input.parentId} not found`);
    }
  }

  return prisma.forumCategory.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      visibility: input.visibility || 'public',
    },
  });
}

/**
 * Get forum category by ID
 */
export async function getForumCategory(
  prisma: PrismaClient,
  categoryId: string
): Promise<ForumCategory | null> {
  return prisma.forumCategory.findUnique({
    where: { id: categoryId },
  });
}

/**
 * List forum categories with optional filters
 */
export async function listForumCategories(
  prisma: PrismaClient,
  options?: {
    parentId?: string | null;
    visibility?: CategoryVisibility;
  }
): Promise<ForumCategory[]> {
  const where: Prisma.ForumCategoryWhereInput = {};

  if (options?.parentId !== undefined) {
    where.parentId = options.parentId;
  }
  if (options?.visibility) {
    where.visibility = options.visibility;
  }

  return prisma.forumCategory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update forum category
 */
export async function updateForumCategory(
  prisma: PrismaClient,
  categoryId: string,
  updates: Partial<ForumCategoryInput>
): Promise<ForumCategory> {
  const category = await getForumCategory(prisma, categoryId);
  if (!category) {
    throw new Error(`Category ${categoryId} not found`);
  }

  // Validate parent if changing
  if (updates.parentId !== undefined && updates.parentId !== null) {
    if (updates.parentId === categoryId) {
      throw new Error('Category cannot be its own parent');
    }
    const parent = await getForumCategory(prisma, updates.parentId);
    if (!parent) {
      throw new Error(`Parent category ${updates.parentId} not found`);
    }
  }

  const data: Prisma.ForumCategoryUpdateInput = {};
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description ?? null;
  if (updates.parentId !== undefined) data.parentId = updates.parentId ?? null;
  if (updates.visibility !== undefined) {
    data.visibility = validateVisibility(updates.visibility);
  }

  return prisma.forumCategory.update({
    where: { id: categoryId },
    data,
  });
}

/**
 * Delete forum category (only if no posts exist)
 */
export async function deleteForumCategory(
  prisma: PrismaClient,
  categoryId: string
): Promise<void> {
  const category = await getForumCategory(prisma, categoryId);
  if (!category) {
    throw new Error(`Category ${categoryId} not found`);
  }

  // Check for posts
  const postCount = await prisma.forumPost.count({
    where: { categoryId },
  });

  if (postCount > 0) {
    throw new Error(`Cannot delete category with ${postCount} posts`);
  }

  // Check for child categories
  const childCount = await prisma.forumCategory.count({
    where: { parentId: categoryId },
  });

  if (childCount > 0) {
    throw new Error(`Cannot delete category with ${childCount} child categories`);
  }

  await prisma.forumCategory.delete({
    where: { id: categoryId },
  });
}

