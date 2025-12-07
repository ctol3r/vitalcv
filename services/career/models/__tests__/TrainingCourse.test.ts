/**
 * B233A-CAREER-002: TrainingCourse Model Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import * as TrainingCourse from '../TrainingCourse';

// Mock Prisma client
const mockPrisma = {
  trainingCourse: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  trainingEnrollment: {
    count: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TrainingCourse Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTrainingCourseInput', () => {
    it('should validate valid input', () => {
      const input: TrainingCourse.TrainingCourseInput = {
        title: 'Advanced Cardiology',
        providerId: 'provider-1',
        providerType: 'module',
        creditHours: 10,
        price: 5000,
      };

      expect(() => TrainingCourse.validateTrainingCourseInput(input)).not.toThrow();
    });

    it('should throw error if title is missing', () => {
      const input = {
        providerId: 'provider-1',
        providerType: 'module',
      } as TrainingCourse.TrainingCourseInput;

      expect(() => TrainingCourse.validateTrainingCourseInput(input)).toThrow('title is required');
    });

    it('should throw error if providerId is missing', () => {
      const input = {
        title: 'Test Course',
        providerType: 'module',
      } as TrainingCourse.TrainingCourseInput;

      expect(() => TrainingCourse.validateTrainingCourseInput(input)).toThrow(
        'providerId is required'
      );
    });

    it('should throw error if providerType is invalid', () => {
      const input = {
        title: 'Test Course',
        providerId: 'provider-1',
        providerType: 'invalid',
      } as unknown as TrainingCourse.TrainingCourseInput;

      expect(() => TrainingCourse.validateTrainingCourseInput(input)).toThrow(
        'providerType must be either "module" or "org"'
      );
    });

    it('should throw error if creditHours is negative', () => {
      const input: TrainingCourse.TrainingCourseInput = {
        title: 'Test Course',
        providerId: 'provider-1',
        providerType: 'module',
        creditHours: -1,
      };

      expect(() => TrainingCourse.validateTrainingCourseInput(input)).toThrow(
        'creditHours must be a non-negative number'
      );
    });

    it('should throw error if price is negative', () => {
      const input: TrainingCourse.TrainingCourseInput = {
        title: 'Test Course',
        providerId: 'provider-1',
        providerType: 'module',
        price: -1,
      };

      expect(() => TrainingCourse.validateTrainingCourseInput(input)).toThrow(
        'price must be a non-negative number'
      );
    });
  });

  describe('createTrainingCourse', () => {
    it('should create a training course', async () => {
      const input: TrainingCourse.TrainingCourseInput = {
        title: 'Advanced Cardiology',
        description: 'Learn advanced cardiology techniques',
        providerId: 'provider-1',
        providerType: 'module',
        credentialAwarded: 'Cardiology Certificate',
        creditHours: 10,
        price: 5000,
        tags: ['cardiology', 'medical'],
      };

      const mockCourse = {
        id: 'course-1',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.trainingCourse.create as jest.Mock).mockResolvedValue(mockCourse);

      const result = await TrainingCourse.createTrainingCourse(mockPrisma, input);

      expect(result).toEqual(mockCourse);
      expect(mockPrisma.trainingCourse.create).toHaveBeenCalled();
    });
  });

  describe('getTrainingCourse', () => {
    it('should get training course by ID', async () => {
      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
        description: null,
        providerId: 'provider-1',
        providerType: 'module',
        credentialAwarded: null,
        creditHours: 10,
        price: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.trainingCourse.findUnique as jest.Mock).mockResolvedValue(mockCourse);

      const result = await TrainingCourse.getTrainingCourse(mockPrisma, 'course-1');

      expect(result).toEqual(mockCourse);
      expect(mockPrisma.trainingCourse.findUnique).toHaveBeenCalledWith({
        where: { id: 'course-1' },
      });
    });

    it('should return null if course not found', async () => {
      (mockPrisma.trainingCourse.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await TrainingCourse.getTrainingCourse(mockPrisma, 'course-1');

      expect(result).toBeNull();
    });
  });

  describe('listTrainingCourses', () => {
    it('should list training courses with filters', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'Course 1',
          providerId: 'provider-1',
          providerType: 'module',
          creditHours: 10,
          tags: ['cardiology'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.trainingCourse.findMany as jest.Mock).mockResolvedValue(mockCourses);
      (mockPrisma.trainingCourse.count as jest.Mock).mockResolvedValue(1);

      const result = await TrainingCourse.listTrainingCourses(mockPrisma, {
        providerId: 'provider-1',
        tags: ['cardiology'],
      });

      expect(result.courses).toEqual(mockCourses);
      expect(result.total).toBe(1);
    });
  });

  describe('deleteTrainingCourse', () => {
    it('should delete training course if no enrollments', async () => {
      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
      };

      (mockPrisma.trainingEnrollment.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.trainingCourse.delete as jest.Mock).mockResolvedValue(mockCourse);

      const result = await TrainingCourse.deleteTrainingCourse(mockPrisma, 'course-1');

      expect(result).toEqual(mockCourse);
      expect(mockPrisma.trainingEnrollment.count).toHaveBeenCalledWith({
        where: { courseId: 'course-1' },
      });
    });

    it('should throw error if course has enrollments', async () => {
      (mockPrisma.trainingEnrollment.count as jest.Mock).mockResolvedValue(5);

      await expect(
        TrainingCourse.deleteTrainingCourse(mockPrisma, 'course-1')
      ).rejects.toThrow('Cannot delete course with 5 active enrollment(s)');
    });
  });
});

