/**
 * B249B-LRN-018: CourseReviewService
 *
 * Manages reviews: submitReview, getReviews; ensures profanity filter;
 * allows reporting inappropriate reviews for moderation; notifies instructors
 */

import { PrismaClient } from '@prisma/client';
import { emitEvent } from '../../../backend/src/agents/bus';

export interface ReviewInput {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfanityFilterResult {
  hasProfanity: boolean;
  filteredText?: string;
  flaggedWords?: string[];
}

export class CourseReviewService {
  private profanityWords: Set<string>;

  constructor(private prisma: PrismaClient) {
    // Simple profanity filter - in production, use a proper library
    this.profanityWords = new Set([
      // Add common profanity words here (simplified for demo)
      'badword1',
      'badword2',
      // In production, use a library like 'bad-words' or similar
    ]);
  }

  /**
   * Submit a review for a course
   */
  async submitReview(input: ReviewInput): Promise<CourseReview> {
    // Validate rating
    if (input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Check if user is enrolled and completed the course
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: input.userId,
          courseId: input.courseId,
        },
      },
    });

    if (!enrollment) {
      throw new Error('You must be enrolled in the course to submit a review');
    }

    if (enrollment.status !== 'completed') {
      throw new Error('You must complete the course before submitting a review');
    }

    // Check for existing review
    const existingReview = await this.prisma.courseReview.findUnique({
      where: {
        userId_courseId: {
          userId: input.userId,
          courseId: input.courseId,
        },
      },
    });

    if (existingReview) {
      throw new Error('You have already submitted a review for this course');
    }

    // Filter profanity from comment
    let filteredComment = input.comment;
    let status = 'approved';
    const profanityCheck = this.checkProfanity(input.comment || '');

    if (profanityCheck.hasProfanity) {
      filteredComment = profanityCheck.filteredText || input.comment;
      status = 'pending'; // Flag for moderation
    }

    // Create review
    const review = await this.prisma.courseReview.create({
      data: {
        courseId: input.courseId,
        userId: input.userId,
        rating: input.rating,
        comment: filteredComment || null,
        status,
      },
    });

    // Notify instructor if review is flagged
    if (status === 'pending') {
      await this.notifyInstructor(input.courseId, review.id, 'Review flagged for moderation');
    } else {
      // Notify instructor of new review
      await this.notifyInstructor(input.courseId, review.id, 'New review submitted');
    }

    return review;
  }

  /**
   * Get reviews for a course
   */
  async getReviews(
    courseId: string,
    options?: {
      status?: string;
      minRating?: number;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ reviews: CourseReview[]; total: number; averageRating: number }> {
    const where: any = {
      courseId,
      status: options?.status || 'approved',
    };

    if (options?.minRating) {
      where.rating = { gte: options.minRating };
    }

    const [reviews, total, allReviews] = await Promise.all([
      this.prisma.courseReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit,
        skip: options?.offset,
      }),
      this.prisma.courseReview.count({ where }),
      this.prisma.courseReview.findMany({
        where: { courseId, status: 'approved' },
        select: { rating: true },
      }),
    ]);

    // Calculate average rating
    const averageRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

    return {
      reviews,
      total,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    };
  }

  /**
   * Report an inappropriate review
   */
  async reportReview(reviewId: string, reason: string, reportedBy: string): Promise<void> {
    const review = await this.prisma.courseReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    // Update review status to flagged
    await this.prisma.courseReview.update({
      where: { id: reviewId },
      data: {
        status: 'flagged',
        reportedAt: new Date(),
        reportedReason: reason,
      },
    });

    // Notify instructor
    await this.notifyInstructor(review.courseId, reviewId, `Review reported: ${reason}`);

    // Emit event
    emitEvent({
      type: 'REVIEW_REPORTED',
      reviewId,
      courseId: review.courseId,
      reason,
      reportedBy,
    } as any);
  }

  /**
   * Update review status (for moderation)
   */
  async updateReviewStatus(
    reviewId: string,
    status: 'approved' | 'flagged' | 'removed',
    moderatorId: string
  ): Promise<CourseReview> {
    const review = await this.prisma.courseReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    const updated = await this.prisma.courseReview.update({
      where: { id: reviewId },
      data: {
        status,
      },
    });

    // Notify instructor of status change
    await this.notifyInstructor(
      review.courseId,
      reviewId,
      `Review status changed to ${status} by moderator`
    );

    return updated;
  }

  /**
   * Get user's reviews
   */
  async getUserReviews(userId: string): Promise<CourseReview[]> {
    return this.prisma.courseReview.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Check for profanity in text
   */
  private checkProfanity(text: string): ProfanityFilterResult {
    if (!text) {
      return { hasProfanity: false };
    }

    const words = text.toLowerCase().split(/\s+/);
    const flaggedWords: string[] = [];

    for (const word of words) {
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (this.profanityWords.has(cleanWord)) {
        flaggedWords.push(word);
      }
    }

    if (flaggedWords.length > 0) {
      // Replace flagged words with asterisks
      let filteredText = text;
      for (const word of flaggedWords) {
        const regex = new RegExp(word, 'gi');
        filteredText = filteredText.replace(regex, '*'.repeat(word.length));
      }

      return {
        hasProfanity: true,
        filteredText,
        flaggedWords,
      };
    }

    return { hasProfanity: false };
  }

  /**
   * Notify instructor of review activity
   */
  private async notifyInstructor(courseId: string, reviewId: string, message: string): Promise<void> {
    // In a real implementation, you would:
    // 1. Get course instructor
    // 2. Send notification (email, in-app, etc.)
    // For now, we'll just emit an event

    emitEvent({
      type: 'INSTRUCTOR_NOTIFICATION',
      courseId,
      reviewId,
      message,
    } as any);
  }
}

