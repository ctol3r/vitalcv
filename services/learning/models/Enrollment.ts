/**
 * B249A-LRN-005: Enrollment Model
 *
 * Model for tracking user enrollment in courses
 */

import { PrismaClient } from '@prisma/client';

export enum EnrollmentStatus {
  ENROLLED = 'enrolled',
  COMPLETED = 'completed',
  DROPPED = 'dropped',
}

export interface EnrollmentInput {
  courseId: string;
  userId: string;
  enrollmentDate?: Date;
  status?: EnrollmentStatus;
  progressPercent?: number;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: Date;
  completionDate: Date | null;
  status: EnrollmentStatus;
  progressPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate enrollment input
 */
export function validateEnrollmentInput(input: EnrollmentInput): void {
  if (!input.courseId || input.courseId.trim().length === 0) {
    throw new Error('courseId is required');
  }
  if (!input.userId || input.userId.trim().length === 0) {
    throw new Error('userId is required');
  }
  if (input.progressPercent !== undefined) {
    if (typeof input.progressPercent !== 'number' || input.progressPercent < 0 || input.progressPercent > 100) {
      throw new Error('progressPercent must be a number between 0 and 100');
    }
  }
  if (input.status && !Object.values(EnrollmentStatus).includes(input.status)) {
    throw new Error(`status must be one of: ${Object.values(EnrollmentStatus).join(', ')}`);
  }
}

/**
 * Create enrollment
 */
export async function createEnrollment(
  prisma: PrismaClient,
  input: EnrollmentInput
): Promise<Enrollment> {
  validateEnrollmentInput(input);

  // Verify course exists
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
  });

  if (!course) {
    throw new Error(`Course with id "${input.courseId}" does not exist`);
  }

  // Check if user is already enrolled
  const existing = await prisma.enrollment.findFirst({
    where: {
      courseId: input.courseId,
      userId: input.userId,
      status: { not: EnrollmentStatus.DROPPED },
    },
  });

  if (existing) {
    throw new Error('User is already enrolled in this course');
  }

  const enrolledAt = input.enrollmentDate ?? new Date();
  const completionDate = input.status === EnrollmentStatus.COMPLETED ? enrolledAt : null;

  return prisma.enrollment.create({
    data: {
      courseId: input.courseId,
      userId: input.userId,
      enrolledAt,
      completionDate,
      status: input.status ?? EnrollmentStatus.ENROLLED,
      progressPercent: input.progressPercent ?? 0,
    },
  });
}

/**
 * Get enrollment by ID
 */
export async function getEnrollment(
  prisma: PrismaClient,
  enrollmentId: string
): Promise<Enrollment | null> {
  return prisma.enrollment.findUnique({
    where: { id: enrollmentId },
  });
}

/**
 * Get enrollment by user and course
 */
export async function getEnrollmentByUserAndCourse(
  prisma: PrismaClient,
  userId: string,
  courseId: string
): Promise<Enrollment | null> {
  return prisma.enrollment.findFirst({
    where: {
      userId,
      courseId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * List enrollments with optional filters
 */
export interface ListEnrollmentsOptions {
  userId?: string;
  courseId?: string;
  status?: EnrollmentStatus;
  limit?: number;
  offset?: number;
}

export async function listEnrollments(
  prisma: PrismaClient,
  options?: ListEnrollmentsOptions
): Promise<{ enrollments: Enrollment[]; total: number }> {
  const where: any = {};

  if (options?.userId) {
    where.userId = options.userId;
  }
  if (options?.courseId) {
    where.courseId = options.courseId;
  }
  if (options?.status) {
    where.status = options.status;
  }

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { enrolledAt: 'desc' },
    }),
    prisma.enrollment.count({ where }),
  ]);

  return { enrollments, total };
}

/**
 * Update enrollment
 */
export async function updateEnrollment(
  prisma: PrismaClient,
  enrollmentId: string,
  updates: Partial<EnrollmentInput & { completionDate?: Date | null }>
): Promise<Enrollment> {
  if (updates.progressPercent !== undefined) {
    if (typeof updates.progressPercent !== 'number' || updates.progressPercent < 0 || updates.progressPercent > 100) {
      throw new Error('progressPercent must be a number between 0 and 100');
    }
  }
  if (updates.status && !Object.values(EnrollmentStatus).includes(updates.status)) {
    throw new Error(`status must be one of: ${Object.values(EnrollmentStatus).join(', ')}`);
  }

  const data: any = {
    ...(updates.status && { status: updates.status }),
    ...(updates.progressPercent !== undefined && { progressPercent: updates.progressPercent }),
    ...(updates.completionDate !== undefined && { completionDate: updates.completionDate }),
  };

  // Auto-set completionDate when status changes to COMPLETED
  if (updates.status === EnrollmentStatus.COMPLETED && !updates.completionDate) {
    data.completionDate = new Date();
  }
  // Clear completionDate when status changes from COMPLETED
  if (updates.status && updates.status !== EnrollmentStatus.COMPLETED && updates.completionDate === undefined) {
    const current = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (current?.status === EnrollmentStatus.COMPLETED) {
      data.completionDate = null;
    }
  }

  return prisma.enrollment.update({
    where: { id: enrollmentId },
    data,
  });
}

/**
 * Delete enrollment
 */
export async function deleteEnrollment(
  prisma: PrismaClient,
  enrollmentId: string
): Promise<Enrollment> {
  return prisma.enrollment.delete({
    where: { id: enrollmentId },
  });
}

