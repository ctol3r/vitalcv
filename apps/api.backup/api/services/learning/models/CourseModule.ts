/**
 * B249A-LRN-002: CourseModule Model
 *
 * Model for course modules with ordering
 */

import { PrismaClient } from '@prisma/client';

export interface CourseModuleInput {
  courseId: string;
  title: string;
  description?: string;
  contentUrl?: string;
  durationMinutes?: number;
  order: number;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  contentUrl: string | null;
  durationMinutes: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate course module input
 */
export function validateCourseModuleInput(input: CourseModuleInput): void {
  if (!input.courseId || input.courseId.trim().length === 0) {
    throw new Error('courseId is required');
  }
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('title is required');
  }
  if (typeof input.order !== 'number' || input.order < 0) {
    throw new Error('order must be a non-negative integer');
  }
  if (input.durationMinutes !== undefined && (typeof input.durationMinutes !== 'number' || input.durationMinutes < 0)) {
    throw new Error('durationMinutes must be a non-negative integer');
  }
}

/**
 * Create course module
 */
export async function createCourseModule(
  prisma: PrismaClient,
  input: CourseModuleInput
): Promise<CourseModule> {
  validateCourseModuleInput(input);

  // Verify course exists
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
  });

  if (!course) {
    throw new Error(`Course with id "${input.courseId}" does not exist`);
  }

  return prisma.courseModule.create({
    data: {
      courseId: input.courseId,
      title: input.title,
      description: input.description ?? null,
      contentUrl: input.contentUrl ?? null,
      durationMinutes: input.durationMinutes ?? 0,
      order: input.order,
    },
  });
}

/**
 * Get course module by ID
 */
export async function getCourseModule(
  prisma: PrismaClient,
  moduleId: string
): Promise<CourseModule | null> {
  return prisma.courseModule.findUnique({
    where: { id: moduleId },
  });
}

/**
 * List modules for a course, ordered by order field
 */
export async function listCourseModules(
  prisma: PrismaClient,
  courseId: string
): Promise<CourseModule[]> {
  return prisma.courseModule.findMany({
    where: { courseId },
    orderBy: { order: 'asc' },
  });
}

/**
 * Update course module
 */
export async function updateCourseModule(
  prisma: PrismaClient,
  moduleId: string,
  updates: Partial<CourseModuleInput>
): Promise<CourseModule> {
  if (updates.courseId) {
    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { id: updates.courseId },
    });
    if (!course) {
      throw new Error(`Course with id "${updates.courseId}" does not exist`);
    }
  }
  if (updates.order !== undefined && (typeof updates.order !== 'number' || updates.order < 0)) {
    throw new Error('order must be a non-negative integer');
  }
  if (updates.durationMinutes !== undefined && (typeof updates.durationMinutes !== 'number' || updates.durationMinutes < 0)) {
    throw new Error('durationMinutes must be a non-negative integer');
  }

  return prisma.courseModule.update({
    where: { id: moduleId },
    data: {
      ...(updates.courseId && { courseId: updates.courseId }),
      ...(updates.title && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
      ...(updates.contentUrl !== undefined && { contentUrl: updates.contentUrl ?? null }),
      ...(updates.durationMinutes !== undefined && { durationMinutes: updates.durationMinutes }),
      ...(updates.order !== undefined && { order: updates.order }),
    },
  });
}

/**
 * Delete course module
 */
export async function deleteCourseModule(
  prisma: PrismaClient,
  moduleId: string
): Promise<CourseModule> {
  return prisma.courseModule.delete({
    where: { id: moduleId },
  });
}

/**
 * Reorder modules for a course
 */
export async function reorderCourseModules(
  prisma: PrismaClient,
  courseId: string,
  moduleOrders: Array<{ moduleId: string; order: number }>
): Promise<void> {
  await prisma.$transaction(
    moduleOrders.map(({ moduleId, order }) =>
      prisma.courseModule.update({
        where: { id: moduleId },
        data: { order },
      })
    )
  );
}

