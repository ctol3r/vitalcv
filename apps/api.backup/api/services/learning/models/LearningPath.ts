/**
 * B249A-LRN-003: LearningPath Model
 *
 * Model for learning paths with course ordering
 */

import { PrismaClient } from '@prisma/client';

export enum LearningPathStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export interface LearningPathInput {
  name: string;
  slug: string;
  description?: string;
  courseIds: string[];
  recommendedOrder?: number[]; // Array of course order indices
  status?: LearningPathStatus;
}

export interface LearningPath {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  courseIds: string[];
  recommendedOrder: number[] | null;
  status: LearningPathStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate learning path input
 */
export function validateLearningPathInput(input: LearningPathInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.slug || input.slug.trim().length === 0) {
    throw new Error('slug is required');
  }
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
  }
  if (!Array.isArray(input.courseIds)) {
    throw new Error('courseIds must be an array');
  }
  if (input.status && !Object.values(LearningPathStatus).includes(input.status)) {
    throw new Error(`status must be one of: ${Object.values(LearningPathStatus).join(', ')}`);
  }
  if (input.recommendedOrder && !Array.isArray(input.recommendedOrder)) {
    throw new Error('recommendedOrder must be an array');
  }
}

/**
 * Create learning path
 */
export async function createLearningPath(
  prisma: PrismaClient,
  input: LearningPathInput
): Promise<LearningPath> {
  validateLearningPathInput(input);

  // Check if slug already exists
  const existing = await prisma.learningPath.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error(`Learning path with slug "${input.slug}" already exists`);
  }

  // Verify all courseIds exist
  if (input.courseIds.length > 0) {
    const courses = await prisma.course.findMany({
      where: { id: { in: input.courseIds } },
      select: { id: true },
    });

    const foundIds = new Set(courses.map((c) => c.id));
    const missingIds = input.courseIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      throw new Error(`Courses not found: ${missingIds.join(', ')}`);
    }
  }

  return prisma.learningPath.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      courseIds: input.courseIds,
      recommendedOrder: input.recommendedOrder ?? null,
      status: input.status ?? LearningPathStatus.DRAFT,
    },
  });
}

/**
 * Get learning path by ID
 */
export async function getLearningPath(
  prisma: PrismaClient,
  pathId: string
): Promise<LearningPath | null> {
  return prisma.learningPath.findUnique({
    where: { id: pathId },
  });
}

/**
 * Get learning path by slug
 */
export async function getLearningPathBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<LearningPath | null> {
  return prisma.learningPath.findUnique({
    where: { slug },
  });
}

/**
 * List learning paths with optional filters
 */
export interface ListLearningPathsOptions {
  status?: LearningPathStatus;
  limit?: number;
  offset?: number;
}

export async function listLearningPaths(
  prisma: PrismaClient,
  options?: ListLearningPathsOptions
): Promise<{ paths: LearningPath[]; total: number }> {
  const where: any = {};

  if (options?.status) {
    where.status = options.status;
  }

  const [paths, total] = await Promise.all([
    prisma.learningPath.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.learningPath.count({ where }),
  ]);

  return { paths, total };
}

/**
 * Update learning path
 */
export async function updateLearningPath(
  prisma: PrismaClient,
  pathId: string,
  updates: Partial<LearningPathInput>
): Promise<LearningPath> {
  if (updates.slug) {
    if (!/^[a-z0-9-]+$/.test(updates.slug)) {
      throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
    }
    // Check if slug is already taken by another path
    const existing = await prisma.learningPath.findUnique({
      where: { slug: updates.slug },
    });
    if (existing && existing.id !== pathId) {
      throw new Error(`Learning path with slug "${updates.slug}" already exists`);
    }
  }

  // Verify all courseIds exist if provided
  if (updates.courseIds && updates.courseIds.length > 0) {
    const courses = await prisma.course.findMany({
      where: { id: { in: updates.courseIds } },
      select: { id: true },
    });

    const foundIds = new Set(courses.map((c) => c.id));
    const missingIds = updates.courseIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      throw new Error(`Courses not found: ${missingIds.join(', ')}`);
    }
  }

  if (updates.status && !Object.values(LearningPathStatus).includes(updates.status)) {
    throw new Error(`status must be one of: ${Object.values(LearningPathStatus).join(', ')}`);
  }

  return prisma.learningPath.update({
    where: { id: pathId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
      ...(updates.courseIds !== undefined && { courseIds: updates.courseIds }),
      ...(updates.recommendedOrder !== undefined && { recommendedOrder: updates.recommendedOrder ?? null }),
      ...(updates.status && { status: updates.status }),
    },
  });
}

/**
 * Delete learning path
 */
export async function deleteLearningPath(
  prisma: PrismaClient,
  pathId: string
): Promise<LearningPath> {
  return prisma.learningPath.delete({
    where: { id: pathId },
  });
}

