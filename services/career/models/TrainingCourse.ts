/**
 * B233A-CAREER-002: TrainingCourse Model
 *
 * Model for training courses with all required fields
 */

import { PrismaClient } from '@prisma/client';

export interface TrainingCourseInput {
  title: string;
  description?: string;
  providerId: string;
  providerType: 'module' | 'org';
  credentialAwarded?: string;
  creditHours?: number;
  price?: number; // Price in cents
  tags?: string[];
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string | null;
  providerId: string;
  providerType: string;
  credentialAwarded: string | null;
  creditHours: number;
  price: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate training course input
 */
export function validateTrainingCourseInput(input: TrainingCourseInput): void {
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('title is required');
  }
  if (!input.providerId || input.providerId.trim().length === 0) {
    throw new Error('providerId is required');
  }
  if (!input.providerType || !['module', 'org'].includes(input.providerType)) {
    throw new Error('providerType must be either "module" or "org"');
  }
  if (input.creditHours !== undefined && (typeof input.creditHours !== 'number' || input.creditHours < 0)) {
    throw new Error('creditHours must be a non-negative number');
  }
  if (input.price !== undefined && (typeof input.price !== 'number' || input.price < 0)) {
    throw new Error('price must be a non-negative number');
  }
  if (input.tags && !Array.isArray(input.tags)) {
    throw new Error('tags must be an array');
  }
}

/**
 * Create training course
 */
export async function createTrainingCourse(
  prisma: PrismaClient,
  input: TrainingCourseInput
): Promise<TrainingCourse> {
  validateTrainingCourseInput(input);

  return prisma.trainingCourse.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      providerId: input.providerId,
      providerType: input.providerType,
      credentialAwarded: input.credentialAwarded ?? null,
      creditHours: input.creditHours ?? 0,
      price: input.price ?? null,
      tags: input.tags ?? [],
    },
  });
}

/**
 * Get training course by ID
 */
export async function getTrainingCourse(
  prisma: PrismaClient,
  courseId: string
): Promise<TrainingCourse | null> {
  return prisma.trainingCourse.findUnique({
    where: { id: courseId },
  });
}

/**
 * List training courses with optional filters
 */
export interface ListCoursesOptions {
  providerId?: string;
  providerType?: 'module' | 'org';
  tags?: string[];
  limit?: number;
  offset?: number;
}

export async function listTrainingCourses(
  prisma: PrismaClient,
  options?: ListCoursesOptions
): Promise<{ courses: TrainingCourse[]; total: number }> {
  const where: any = {};

  if (options?.providerId) {
    where.providerId = options.providerId;
  }
  if (options?.providerType) {
    where.providerType = options.providerType;
  }
  if (options?.tags && options.tags.length > 0) {
    where.tags = { hasSome: options.tags };
  }

  const [courses, total] = await Promise.all([
    prisma.trainingCourse.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.trainingCourse.count({ where }),
  ]);

  return { courses, total };
}

/**
 * Update training course
 */
export async function updateTrainingCourse(
  prisma: PrismaClient,
  courseId: string,
  updates: Partial<TrainingCourseInput>
): Promise<TrainingCourse> {
  if (updates.creditHours !== undefined && updates.creditHours < 0) {
    throw new Error('creditHours must be non-negative');
  }
  if (updates.price !== undefined && updates.price < 0) {
    throw new Error('price must be non-negative');
  }
  if (updates.tags && !Array.isArray(updates.tags)) {
    throw new Error('tags must be an array');
  }
  if (updates.providerType && !['module', 'org'].includes(updates.providerType)) {
    throw new Error('providerType must be either "module" or "org"');
  }

  return prisma.trainingCourse.update({
    where: { id: courseId },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
      ...(updates.providerId && { providerId: updates.providerId }),
      ...(updates.providerType && { providerType: updates.providerType }),
      ...(updates.credentialAwarded !== undefined && { credentialAwarded: updates.credentialAwarded ?? null }),
      ...(updates.creditHours !== undefined && { creditHours: updates.creditHours }),
      ...(updates.price !== undefined && { price: updates.price ?? null }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
    },
  });
}

/**
 * Delete training course
 */
export async function deleteTrainingCourse(
  prisma: PrismaClient,
  courseId: string
): Promise<TrainingCourse> {
  // Check if there are any enrollments
  const enrollments = await prisma.trainingEnrollment.count({
    where: { courseId },
  });

  if (enrollments > 0) {
    throw new Error(`Cannot delete course with ${enrollments} active enrollment(s)`);
  }

  return prisma.trainingCourse.delete({
    where: { id: courseId },
  });
}

