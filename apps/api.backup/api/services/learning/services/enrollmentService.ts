/**
 * B249B-LRN-012: EnrollmentService
 *
 * Handles enrollments: enrollUser(courseId, userId) after checking prerequisites;
 * prevents duplicate enrollments; updates Enrollment model; emits events
 */

import { PrismaClient } from '@prisma/client';
import { emitEvent } from '../../../backend/src/agents/bus';

export interface EnrollmentInput {
  userId: string;
  courseId: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  progressPercent: number;
  enrolledAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EnrollmentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Enroll a user in a course after checking prerequisites
   */
  async enrollUser(courseId: string, userId: string): Promise<Enrollment> {
    // Check if course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        prerequisites: {
          include: {
            prerequisite: true,
          },
        },
      },
    });

    if (!course) {
      throw new Error(`Course not found: ${courseId}`);
    }

    if (course.status !== 'published') {
      throw new Error(`Course is not available for enrollment (status: ${course.status})`);
    }

    // Check prerequisites
    if (course.prerequisites.length > 0) {
      const prerequisiteIds = course.prerequisites.map((p) => p.prerequisiteId);
      const completedPrerequisites = await this.prisma.enrollment.findMany({
        where: {
          userId,
          courseId: { in: prerequisiteIds },
          status: 'completed',
        },
      });

      const completedIds = new Set(completedPrerequisites.map((e) => e.courseId));
      const missingPrerequisites = course.prerequisites.filter(
        (p) => !completedIds.has(p.prerequisiteId)
      );

      if (missingPrerequisites.length > 0) {
        const missingTitles = missingPrerequisites.map((p) => p.prerequisite.title).join(', ');
        throw new Error(
          `Prerequisites not met. Missing: ${missingTitles}. Please complete these courses first.`
        );
      }
    }

    // Check for duplicate enrollment
    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      if (existingEnrollment.status === 'cancelled') {
        // Re-enroll if previously cancelled
        const updated = await this.prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: 'enrolled',
            progressPercent: 0,
            enrolledAt: new Date(),
            completedAt: null,
          },
        });

        // Emit enrollment event
        emitEvent({
          type: 'ENROLLMENT_CREATED',
          userId,
          courseId,
          enrollmentId: updated.id,
        } as any);

        return updated;
      }
      throw new Error(`User is already enrolled in course ${courseId}`);
    }

    // Create enrollment
    const enrollment = await this.prisma.enrollment.create({
      data: {
        userId,
        courseId,
        status: 'enrolled',
        progressPercent: 0,
      },
    });

    // Emit enrollment event
    emitEvent({
      type: 'ENROLLMENT_CREATED',
      userId,
      courseId,
      enrollmentId: enrollment.id,
    } as any);

    return enrollment;
  }

  /**
   * Get enrollment by ID
   */
  async getEnrollment(enrollmentId: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
  }

  /**
   * Get user's enrollments
   */
  async getUserEnrollments(userId: string): Promise<Enrollment[]> {
    return this.prisma.enrollment.findMany({
      where: { userId },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  /**
   * Get course enrollments
   */
  async getCourseEnrollments(courseId: string): Promise<Enrollment[]> {
    return this.prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  /**
   * Check if user is enrolled
   */
  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    return enrollment !== null && enrollment.status !== 'cancelled';
  }

  /**
   * Cancel enrollment
   */
  async cancelEnrollment(enrollmentId: string, userId: string): Promise<Enrollment> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw new Error(`Enrollment not found: ${enrollmentId}`);
    }

    if (enrollment.userId !== userId) {
      throw new Error('Only the enrolled user can cancel this enrollment');
    }

    if (enrollment.status === 'completed') {
      throw new Error('Cannot cancel a completed enrollment');
    }

    const updated = await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'cancelled',
      },
    });

    // Emit cancellation event
    emitEvent({
      type: 'ENROLLMENT_CANCELLED',
      userId,
      courseId: enrollment.courseId,
      enrollmentId: enrollment.id,
    } as any);

    return updated;
  }
}

