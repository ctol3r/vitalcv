/**
 * B249A-LRN-007: CourseCategory Model
 *
 * Model for hierarchical course categories
 */

import { PrismaClient } from '@prisma/client';

export interface CourseCategoryInput {
  name: string;
  slug: string;
  description?: string;
  parentCategoryId?: string | null;
}

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentCategoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate course category input
 */
export function validateCourseCategoryInput(input: CourseCategoryInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.slug || input.slug.trim().length === 0) {
    throw new Error('slug is required');
  }
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
  }
}

/**
 * Check for cycles in category hierarchy
 */
async function checkForCycle(
  prisma: PrismaClient,
  categoryId: string,
  parentId: string | null
): Promise<void> {
  if (!parentId) {
    return; // No parent, no cycle possible
  }

  if (categoryId === parentId) {
    throw new Error('Category cannot be its own parent');
  }

  // Traverse up the hierarchy to check for cycles
  const visited = new Set<string>([categoryId]);
  let currentId: string | null = parentId;

  while (currentId) {
    if (visited.has(currentId)) {
      throw new Error('Creating this relationship would create a cycle in the category hierarchy');
    }
    visited.add(currentId);

    const parent = await prisma.courseCategory.findUnique({
      where: { id: currentId },
      select: { parentCategoryId: true },
    });

    currentId = parent?.parentCategoryId ?? null;
  }
}

/**
 * Create course category
 */
export async function createCourseCategory(
  prisma: PrismaClient,
  input: CourseCategoryInput
): Promise<CourseCategory> {
  validateCourseCategoryInput(input);

  // Check if slug already exists
  const existing = await prisma.courseCategory.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error(`Course category with slug "${input.slug}" already exists`);
  }

  // Verify parent category exists if provided
  if (input.parentCategoryId) {
    const parent = await prisma.courseCategory.findUnique({
      where: { id: input.parentCategoryId },
    });

    if (!parent) {
      throw new Error(`Parent category with id "${input.parentCategoryId}" does not exist`);
    }
  }

  return prisma.courseCategory.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      parentCategoryId: input.parentCategoryId ?? null,
    },
  });
}

/**
 * Get course category by ID
 */
export async function getCourseCategory(
  prisma: PrismaClient,
  categoryId: string
): Promise<CourseCategory | null> {
  return prisma.courseCategory.findUnique({
    where: { id: categoryId },
  });
}

/**
 * Get course category by slug
 */
export async function getCourseCategoryBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<CourseCategory | null> {
  return prisma.courseCategory.findUnique({
    where: { slug },
  });
}

/**
 * List course categories
 */
export interface ListCourseCategoriesOptions {
  parentCategoryId?: string | null;
  limit?: number;
  offset?: number;
}

export async function listCourseCategories(
  prisma: PrismaClient,
  options?: ListCourseCategoriesOptions
): Promise<{ categories: CourseCategory[]; total: number }> {
  const where: any = {};

  if (options?.parentCategoryId !== undefined) {
    where.parentCategoryId = options.parentCategoryId;
  }

  const [categories, total] = await Promise.all([
    prisma.courseCategory.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { name: 'asc' },
    }),
    prisma.courseCategory.count({ where }),
  ]);

  return { categories, total };
}

/**
 * Get category hierarchy (all children)
 */
export async function getCategoryChildren(
  prisma: PrismaClient,
  categoryId: string
): Promise<CourseCategory[]> {
  return prisma.courseCategory.findMany({
    where: { parentCategoryId: categoryId },
    orderBy: { name: 'asc' },
  });
}

/**
 * Update course category
 */
export async function updateCourseCategory(
  prisma: PrismaClient,
  categoryId: string,
  updates: Partial<CourseCategoryInput>
): Promise<CourseCategory> {
  if (updates.slug) {
    if (!/^[a-z0-9-]+$/.test(updates.slug)) {
      throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
    }
    // Check if slug is already taken by another category
    const existing = await prisma.courseCategory.findUnique({
      where: { slug: updates.slug },
    });
    if (existing && existing.id !== categoryId) {
      throw new Error(`Course category with slug "${updates.slug}" already exists`);
    }
  }

  // Verify parent category exists if provided
  if (updates.parentCategoryId !== undefined && updates.parentCategoryId !== null) {
    const parent = await prisma.courseCategory.findUnique({
      where: { id: updates.parentCategoryId },
    });

    if (!parent) {
      throw new Error(`Parent category with id "${updates.parentCategoryId}" does not exist`);
    }

    // Check for cycles
    await checkForCycle(prisma, categoryId, updates.parentCategoryId);
  }

  return prisma.courseCategory.update({
    where: { id: categoryId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
      ...(updates.parentCategoryId !== undefined && { parentCategoryId: updates.parentCategoryId ?? null }),
    },
  });
}

/**
 * Delete course category
 */
export async function deleteCourseCategory(
  prisma: PrismaClient,
  categoryId: string
): Promise<CourseCategory> {
  // Check if category has children
  const children = await prisma.courseCategory.count({
    where: { parentCategoryId: categoryId },
  });

  if (children > 0) {
    throw new Error(`Cannot delete category with ${children} child category(ies). Please reassign or delete children first.`);
  }

  // Check if category has courses
  const courses = await prisma.course.count({
    where: { categoryId },
  });

  if (courses > 0) {
    throw new Error(`Cannot delete category with ${courses} course(s). Please reassign courses first.`);
  }

  return prisma.courseCategory.delete({
    where: { id: categoryId },
  });
}

