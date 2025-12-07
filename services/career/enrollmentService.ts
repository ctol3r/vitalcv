/**
 * B233A-CAREER-005: TrainingEnrollmentService
 *
 * Handles enrollment in TrainingCourse: validates availability, processes payments via Marketplace,
 * awards training credits; updates CareerProfile
 */

import { PrismaClient } from '@prisma/client';
import { getCareerProfile, addTrainingCredits } from './models/CareerProfile';
import { getTrainingCourse, TrainingCourse } from './models/TrainingCourse';

export interface EnrollmentInput {
  userId: string;
  courseId: string;
  paymentId?: string; // Reference to MarketplacePurchase if paid
}

export interface Enrollment {
  id: string;
  userId: string;
  careerProfileId: string;
  courseId: string;
  status: string;
  enrolledAt: Date;
  completedAt: Date | null;
  paymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TrainingEnrollmentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Enroll a user in a training course
   */
  async enrollInCourse(input: EnrollmentInput): Promise<Enrollment> {
    // Validate user has career profile
    const profile = await getCareerProfile(this.prisma, input.userId);
    if (!profile) {
      throw new Error(`Career profile not found for user ${input.userId}`);
    }

    // Validate course exists
    const course = await getTrainingCourse(this.prisma, input.courseId);
    if (!course) {
      throw new Error(`Training course not found: ${input.courseId}`);
    }

    // Check if already enrolled
    const existingEnrollment = await this.prisma.trainingEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: input.userId,
          courseId: input.courseId,
        },
      },
    });

    if (existingEnrollment) {
      throw new Error(`User is already enrolled in course ${input.courseId}`);
    }

    // Validate payment if course has a price
    if (course.price && course.price > 0) {
      if (!input.paymentId) {
        throw new Error(`Payment required for course with price ${course.price}`);
      }

      // Verify payment exists and is completed
      const payment = await this.prisma.marketplacePurchase.findUnique({
        where: { id: input.paymentId },
      });

      if (!payment) {
        throw new Error(`Payment not found: ${input.paymentId}`);
      }

      if (payment.status !== 'completed') {
        throw new Error(`Payment status is ${payment.status}, expected 'completed'`);
      }

      // Verify payment amount matches course price
      if (payment.amount !== course.price) {
        throw new Error(
          `Payment amount ${payment.amount} does not match course price ${course.price}`
        );
      }
    }

    // Create enrollment
    const enrollment = await this.prisma.trainingEnrollment.create({
      data: {
        userId: input.userId,
        careerProfileId: profile.id,
        courseId: input.courseId,
        status: 'enrolled',
        paymentId: input.paymentId ?? null,
      },
    });

    return enrollment;
  }

  /**
   * Complete a course enrollment and award credits
   */
  async completeCourse(enrollmentId: string, userId: string): Promise<Enrollment> {
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });

    if (!enrollment) {
      throw new Error(`Enrollment not found: ${enrollmentId}`);
    }

    if (enrollment.userId !== userId) {
      throw new Error('Only the enrolled user can complete this course');
    }

    if (enrollment.status !== 'enrolled') {
      throw new Error(`Cannot complete enrollment with status: ${enrollment.status}`);
    }

    // Update enrollment status
    const updatedEnrollment = await this.prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // Award training credits
    if (enrollment.course.creditHours > 0) {
      await addTrainingCredits(this.prisma, userId, enrollment.course.creditHours);
    }

    return updatedEnrollment;
  }

  /**
   * Cancel an enrollment
   */
  async cancelEnrollment(enrollmentId: string, userId: string): Promise<Enrollment> {
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
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

    if (enrollment.status === 'cancelled') {
      throw new Error('Enrollment is already cancelled');
    }

    return this.prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'cancelled',
      },
    });
  }

  /**
   * Get user's enrollments
   */
  async getUserEnrollments(userId: string): Promise<Array<Enrollment & { course: TrainingCourse }>> {
    return this.prisma.trainingEnrollment.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  /**
   * Get enrollments for a specific course
   */
  async getCourseEnrollments(courseId: string): Promise<Array<Enrollment & { course: TrainingCourse }>> {
    return this.prisma.trainingEnrollment.findMany({
      where: { courseId },
      include: { course: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  /**
   * Get enrollment by ID
   */
  async getEnrollment(enrollmentId: string): Promise<(Enrollment & { course: TrainingCourse }) | null> {
    return this.prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });
  }

  /**
   * Check if user is enrolled in a course
   */
  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
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
   * Get enrollment statistics for a user
   */
  async getEnrollmentStats(userId: string): Promise<{
    totalEnrollments: number;
    completedCourses: number;
    coursesInProgress: number;
    totalCreditsEarned: number;
  }> {
    const enrollments = await this.prisma.trainingEnrollment.findMany({
      where: { userId },
      include: { course: true },
    });

    const completedCourses = enrollments.filter((e) => e.status === 'completed');
    const coursesInProgress = enrollments.filter((e) => e.status === 'enrolled');
    const totalCreditsEarned = completedCourses.reduce(
      (sum, e) => sum + e.course.creditHours,
      0
    );

    return {
      totalEnrollments: enrollments.length,
      completedCourses: completedCourses.length,
      coursesInProgress: coursesInProgress.length,
      totalCreditsEarned,
    };
  }
}

