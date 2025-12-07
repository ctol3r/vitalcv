/**
 * B249A-LRN-001: Course Model
 *
 * Model for courses with all required fields
 */

import { PrismaClient } from '@prisma/client';

export enum CourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export interface CourseInput {
  title: string;
  slug: string;
  description?: string;
  categoryId?: string;
  tags?: string[];
  creditHours?: number; // Decimal as number (will be stored as Decimal in DB)
  releaseDate?: Date;
  status?: CourseStatus;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  tags: string[];
  creditHours: number;
  releaseDate: Date | null;
  status: CourseStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate course input
 */
export function validateCourseInput(input: CourseInput): void {
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('title is required');
  }
  if (!input.slug || input.slug.trim().length === 0) {
    throw new Error('slug is required');
  }
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
  }
  if (input.creditHours !== undefined && (typeof input.creditHours !== 'number' || input.creditHours < 0)) {
    throw new Error('creditHours must be a non-negative number');
  }
  if (input.status && !Object.values(CourseStatus).includes(input.status)) {
    throw new Error(`status must be one of: ${Object.values(CourseStatus).join(', ')}`);
  }
  if (input.tags && !Array.isArray(input.tags)) {
    throw new Error('tags must be an array');
  }
}

/**
 * Create course
 */
export async function createCourse(
  prisma: PrismaClient,
  input: CourseInput
): Promise<Course> {
  validateCourseInput(input);

  // Check if slug already exists
  const existing = await prisma.course.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error(`Course with slug "${input.slug}" already exists`);
  }

  return prisma.course.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      tags: input.tags ?? [],
      creditHours: input.creditHours ?? 0,
      releaseDate: input.releaseDate ?? null,
      status: input.status ?? CourseStatus.DRAFT,
    },
  });
}

/**
 * Get course by ID
 */
export async function getCourse(
  prisma: PrismaClient,
  courseId: string
): Promise<Course | null> {
  return prisma.course.findUnique({
    where: { id: courseId },
  });
}

/**
 * Get course by slug
 */
export async function getCourseBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<Course | null> {
  return prisma.course.findUnique({
    where: { slug },
  });
}

/**
 * List courses with optional filters
 */
export interface ListCoursesOptions {
  categoryId?: string;
  status?: CourseStatus;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export async function listCourses(
  prisma: PrismaClient,
  options?: ListCoursesOptions
): Promise<{ courses: Course[]; total: number }> {
  const where: any = {};

  if (options?.categoryId) {
    where.categoryId = options.categoryId;
  }
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.tags && options.tags.length > 0) {
    where.tags = { hasSome: options.tags };
  }

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.course.count({ where }),
  ]);

  return { courses, total };
}

/**
 * Update course
 */
export async function updateCourse(
  prisma: PrismaClient,
  courseId: string,
  updates: Partial<CourseInput>
): Promise<Course> {
  if (updates.slug) {
    if (!/^[a-z0-9-]+$/.test(updates.slug)) {
      throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
    }
    // Check if slug is already taken by another course
    const existing = await prisma.course.findUnique({
      where: { slug: updates.slug },
    });
    if (existing && existing.id !== courseId) {
      throw new Error(`Course with slug "${updates.slug}" already exists`);
    }
  }
  if (updates.creditHours !== undefined && updates.creditHours < 0) {
    throw new Error('creditHours must be non-negative');
  }
  if (updates.status && !Object.values(CourseStatus).includes(updates.status)) {
    throw new Error(`status must be one of: ${Object.values(CourseStatus).join(', ')}`);
  }
  if (updates.tags && !Array.isArray(updates.tags)) {
    throw new Error('tags must be an array');
  }

  return prisma.course.update({
    where: { id: courseId },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
      ...(updates.categoryId !== undefined && { categoryId: updates.categoryId ?? null }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      ...(updates.creditHours !== undefined && { creditHours: updates.creditHours }),
      ...(updates.releaseDate !== undefined && { releaseDate: updates.releaseDate ?? null }),
      ...(updates.status && { status: updates.status }),
    },
  });
}

/**
 * Delete course
 */
export async function deleteCourse(
  prisma: PrismaClient,
  courseId: string
): Promise<Course> {
  // Check if there are any enrollments
  const enrollments = await prisma.enrollment.count({
    where: { courseId },
  });

  if (enrollments > 0) {
    throw new Error(`Cannot delete course with ${enrollments} active enrollment(s)`);
  }

  return prisma.course.delete({
    where: { id: courseId },
  });
}

