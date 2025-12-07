/**
 * B233A-CAREER-003: CareerProgressionService Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { CareerProgressionService } from '../progressionService';
import * as CareerProfile from '../models/CareerProfile';

// Mock Prisma client
const mockPrisma = {
  careerProfile: {
    findUnique: jest.fn(),
  },
  trainingEnrollment: {
    findMany: jest.fn(),
  },
  trainingCourse: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('CareerProgressionService', () => {
  let service: CareerProgressionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CareerProgressionService(mockPrisma);
  });

  describe('calculateProgress', () => {
    it('should calculate progress metrics', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
        speciality: 'Cardiology',
        careerGoals: {
          targetRoles: ['Surgeon', 'Consultant'],
        },
        preferredRoles: ['Surgeon'],
        trainingCredits: 15,
        mentorshipStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEnrollments = [
        {
          id: 'enrollment-1',
          userId: 'user-1',
          status: 'completed',
          course: {
            id: 'course-1',
            title: 'Cardiology Basics',
            tags: ['cardiology', 'Surgeon'],
            creditHours: 5,
          },
        },
        {
          id: 'enrollment-2',
          userId: 'user-1',
          status: 'enrolled',
          course: {
            id: 'course-2',
            title: 'Advanced Surgery',
            tags: ['surgery', 'Surgeon'],
            creditHours: 10,
          },
        },
      ];

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (mockPrisma.trainingEnrollment.findMany as jest.Mock).mockResolvedValue(mockEnrollments);
      (mockPrisma.trainingCourse.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.calculateProgress('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.completedCourses).toBe(1);
      expect(result.coursesInProgress).toBe(1);
      expect(result.totalCredits).toBe(15);
      expect(result.upcomingExpirations).toBe(0);
    });

    it('should throw error if profile not found', async () => {
      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.calculateProgress('user-1')).rejects.toThrow(
        'Career profile not found'
      );
    });
  });

  describe('getRecommendedCourses', () => {
    it('should get recommended courses based on career goals', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
        speciality: 'Cardiology',
        careerGoals: {
          targetRoles: ['Surgeon'],
        },
        preferredRoles: ['Surgeon'],
        trainingCredits: 0,
        mentorshipStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCourses = [
        {
          id: 'course-1',
          title: 'Cardiology Basics',
          tags: ['cardiology', 'Surgeon'],
          creditHours: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockEnrollments = [
        {
          courseId: 'course-2',
        },
      ];

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (mockPrisma.trainingEnrollment.findMany as jest.Mock).mockResolvedValue(mockEnrollments);
      (mockPrisma.trainingCourse.findMany as jest.Mock).mockResolvedValue(mockCourses);

      const result = await service.getRecommendedCourses('user-1', 10);

      expect(result).toEqual(mockCourses);
      expect(mockPrisma.trainingCourse.findMany).toHaveBeenCalled();
    });
  });
});

