/**
 * B249A-LRN-009: CourseReview Model
 *
 * Model for course reviews (only enrolled users can review)
 */

import { PrismaClient } from '@prisma/client';

export interface CourseReviewInput {
  courseId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
}

export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  rating: number;
  comment: string | null;
  status: string;
  reportedAt: Date | null;
  reportedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate review input
 */
export function validateCourseReviewInput(input: CourseReviewInput): void {
  if (!input.courseId || input.courseId.trim().length === 0) {
    throw new Error('courseId is required');
  }
  if (!input.userId || input.userId.trim().length === 0) {
    throw new Error('userId is required');
  }
  if (typeof input.rating !== 'number' || input.rating < 1 || input.rating > 5) {
    throw new Error('rating must be a number between 1 and 5');
  }
}

/**
 * Create course review
 */
export async function createCourseReview(
  prisma: PrismaClient,
  input: CourseReviewInput
): Promise<CourseReview> {
  validateCourseReviewInput(input);

  // Verify course exists
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
  });

  if (!course) {
    throw new Error(`Course with id "${input.courseId}" does not exist`);
  }

  // Verify user is enrolled (or was enrolled) in the course
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      courseId: input.courseId,
      userId: input.userId,
    },
  });

  if (!enrollment) {
    throw new Error('Only enrolled users can leave reviews');
  }

  // Check if user already reviewed this course
  const existing = await prisma.courseReview.findFirst({
    where: {
      courseId: input.courseId,
      userId: input.userId,
    },
  });

  if (existing) {
    throw new Error('User has already reviewed this course');
  }

  return prisma.courseReview.create({
    data: {
      courseId: input.courseId,
      userId: input.userId,
      rating: input.rating,
      comment: input.comment ?? null,
      status: 'approved',
    },
  });
}

/**
 * Get review by ID
 */
export async function getCourseReview(
  prisma: PrismaClient,
  reviewId: string
): Promise<CourseReview | null> {
  return prisma.courseReview.findUnique({
    where: { id: reviewId },
  });
}

/**
 * Get review by user and course
 */
export async function getReviewByUserAndCourse(
  prisma: PrismaClient,
  userId: string,
  courseId: string
): Promise<CourseReview | null> {
  return prisma.courseReview.findFirst({
    where: {
      userId,
      courseId,
    },
  });
}

/**
 * List reviews for a course
 */
export interface ListCourseReviewsOptions {
  courseId: string;
  minRating?: number;
  limit?: number;
  offset?: number;
}

export async function listCourseReviews(
  prisma: PrismaClient,
  options: ListCourseReviewsOptions
): Promise<{ reviews: CourseReview[]; total: number; averageRating: number }> {
  const where: any = {
    courseId: options.courseId,
  };

  if (options.minRating) {
    where.rating = { gte: options.minRating };
  }

  const [reviews, total, allReviews] = await Promise.all([
    prisma.courseReview.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.courseReview.count({ where }),
    prisma.courseReview.findMany({
      where: { courseId: options.courseId },
      select: { rating: true },
    }),
  ]);

  const averageRating =
    allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

  return { reviews, total, averageRating };
}

/**
 * Update course review
 */
export async function updateCourseReview(
  prisma: PrismaClient,
  reviewId: string,
  updates: Partial<Pick<CourseReviewInput, 'rating' | 'comment'>>
): Promise<CourseReview> {
  if (updates.rating !== undefined) {
    if (typeof updates.rating !== 'number' || updates.rating < 1 || updates.rating > 5) {
      throw new Error('rating must be a number between 1 and 5');
    }
  }

  return prisma.courseReview.update({
    where: { id: reviewId },
    data: {
      ...(updates.rating !== undefined && { rating: updates.rating }),
      ...(updates.comment !== undefined && { comment: updates.comment ?? null }),
    },
  });
}

/**
 * Delete course review
 */
export async function deleteCourseReview(
  prisma: PrismaClient,
  reviewId: string
): Promise<CourseReview> {
  return prisma.courseReview.delete({
    where: { id: reviewId },
  });
}

