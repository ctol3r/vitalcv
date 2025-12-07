/**
 * B233A-CAREER-005: TrainingEnrollmentService Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { TrainingEnrollmentService } from '../enrollmentService';
import * as CareerProfile from '../models/CareerProfile';
import * as TrainingCourse from '../models/TrainingCourse';

// Mock Prisma client
const mockPrisma = {
  careerProfile: {
    findUnique: jest.fn(),
  },
  trainingCourse: {
    findUnique: jest.fn(),
  },
  trainingEnrollment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  marketplacePurchase: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TrainingEnrollmentService', () => {
  let service: TrainingEnrollmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrainingEnrollmentService(mockPrisma);
  });

  describe('enrollInCourse', () => {
    it('should enroll user in a free course', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
        speciality: 'Cardiology',
        preferredRoles: [],
        careerGoals: null,
        trainingCredits: 0,
        mentorshipStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCourse = {
        id: 'course-1',
        title: 'Free Course',
        description: null,
        providerId: 'provider-1',
        providerType: 'module',
        credentialAwarded: null,
        creditHours: 5,
        price: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEnrollment = {
        id: 'enrollment-1',
        userId: 'user-1',
        careerProfileId: 'profile-1',
        courseId: 'course-1',
        status: 'enrolled',
        enrolledAt: new Date(),
        completedAt: null,
        paymentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (mockPrisma.trainingCourse.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (mockPrisma.trainingEnrollment.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.trainingEnrollment.create as jest.Mock).mockResolvedValue(mockEnrollment);

      const result = await service.enrollInCourse({
        userId: 'user-1',
        courseId: 'course-1',
      });

      expect(result).toEqual(mockEnrollment);
      expect(mockPrisma.trainingEnrollment.create).toHaveBeenCalled();
    });

    it('should enroll user in a paid course with valid payment', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
        speciality: 'Cardiology',
        preferredRoles: [],
        careerGoals: null,
        trainingCredits: 0,
        mentorshipStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCourse = {
        id: 'course-1',
        title: 'Paid Course',
        price: 5000,
        creditHours: 10,
      };

      const mockPayment = {
        id: 'payment-1',
        amount: 5000,
        status: 'completed',
      };

      const mockEnrollment = {
        id: 'enrollment-1',
        userId: 'user-1',
        careerProfileId: 'profile-1',
        courseId: 'course-1',
        status: 'enrolled',
        paymentId: 'payment-1',
        enrolledAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (mockPrisma.trainingCourse.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (mockPrisma.trainingEnrollment.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplacePurchase.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.trainingEnrollment.create as jest.Mock).mockResolvedValue(mockEnrollment);

      const result = await service.enrollInCourse({
        userId: 'user-1',
        courseId: 'course-1',
        paymentId: 'payment-1',
      });

      expect(result).toEqual(mockEnrollment);
    });

    it('should throw error if course requires payment but none provided', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
      };

      const mockCourse = {
        id: 'course-1',
        price: 5000,
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (mockPrisma.trainingCourse.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (mockPrisma.trainingEnrollment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.enrollInCourse({
          userId: 'user-1',
          courseId: 'course-1',
        })
      ).rejects.toThrow('Payment required');
    });

    it('should throw error if user already enrolled', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
      };

      const mockCourse = {
        id: 'course-1',
        price: null,
      };

      const existingEnrollment = {
        id: 'enrollment-1',
        userId: 'user-1',
        courseId: 'course-1',
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (mockPrisma.trainingCourse.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (mockPrisma.trainingEnrollment.findUnique as jest.Mock).mockResolvedValue(
        existingEnrollment
      );

      await expect(
        service.enrollInCourse({
          userId: 'user-1',
          courseId: 'course-1',
        })
      ).rejects.toThrow('already enrolled');
    });
  });

  describe('completeCourse', () => {
    it('should complete course and award credits', async () => {
      const mockEnrollment = {
        id: 'enrollment-1',
        userId: 'user-1',
        status: 'enrolled',
        course: {
          id: 'course-1',
          creditHours: 10,
        },
      };

      const updatedEnrollment = {
        ...mockEnrollment,
        status: 'completed',
        completedAt: new Date(),
      };

      (mockPrisma.trainingEnrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment);
      (mockPrisma.trainingEnrollment.update as jest.Mock).mockResolvedValue(updatedEnrollment);
      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        trainingCredits: 0,
      });
      (mockPrisma.careerProfile.update as jest.Mock).mockResolvedValue({
        trainingCredits: 10,
      });

      const result = await service.completeCourse('enrollment-1', 'user-1');

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
    });

    it('should throw error if not the enrolled user', async () => {
      const mockEnrollment = {
        id: 'enrollment-1',
        userId: 'user-1',
        status: 'enrolled',
        course: {
          creditHours: 10,
        },
      };

      (mockPrisma.trainingEnrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment);

      await expect(service.completeCourse('enrollment-1', 'user-2')).rejects.toThrow(
        'Only the enrolled user can complete'
      );
    });
  });

  describe('getEnrollmentStats', () => {
    it('should calculate enrollment statistics', async () => {
      const mockEnrollments = [
        {
          id: 'enrollment-1',
          userId: 'user-1',
          status: 'completed',
          course: {
            creditHours: 10,
          },
        },
        {
          id: 'enrollment-2',
          userId: 'user-1',
          status: 'enrolled',
          course: {
            creditHours: 5,
          },
        },
        {
          id: 'enrollment-3',
          userId: 'user-1',
          status: 'completed',
          course: {
            creditHours: 15,
          },
        },
      ];

      (mockPrisma.trainingEnrollment.findMany as jest.Mock).mockResolvedValue(mockEnrollments);

      const stats = await service.getEnrollmentStats('user-1');

      expect(stats.totalEnrollments).toBe(3);
      expect(stats.completedCourses).toBe(2);
      expect(stats.coursesInProgress).toBe(1);
      expect(stats.totalCreditsEarned).toBe(25);
    });
  });
});

