/**
 * B233A-CAREER-001: CareerProfile Model Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import * as CareerProfile from '../CareerProfile';

// Mock Prisma client
const mockPrisma = {
  careerProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('CareerProfile Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCareerProfileInput', () => {
    it('should validate valid input', () => {
      const input: CareerProfile.CareerProfileInput = {
        userId: 'user-1',
        speciality: 'Cardiology',
        trainingCredits: 10,
      };

      expect(() => CareerProfile.validateCareerProfileInput(input)).not.toThrow();
    });

    it('should throw error if userId is missing', () => {
      const input = {
        speciality: 'Cardiology',
      } as CareerProfile.CareerProfileInput;

      expect(() => CareerProfile.validateCareerProfileInput(input)).toThrow('userId is required');
    });

    it('should throw error if trainingCredits is negative', () => {
      const input: CareerProfile.CareerProfileInput = {
        userId: 'user-1',
        trainingCredits: -1,
      };

      expect(() => CareerProfile.validateCareerProfileInput(input)).toThrow(
        'trainingCredits must be a non-negative number'
      );
    });

    it('should throw error if preferredRoles is not an array', () => {
      const input = {
        userId: 'user-1',
        preferredRoles: 'not-an-array',
      } as unknown as CareerProfile.CareerProfileInput;

      expect(() => CareerProfile.validateCareerProfileInput(input)).toThrow(
        'preferredRoles must be an array'
      );
    });

    it('should throw error if mentorshipStatus is invalid', () => {
      const input: CareerProfile.CareerProfileInput = {
        userId: 'user-1',
        mentorshipStatus: 'invalid-status',
      };

      expect(() => CareerProfile.validateCareerProfileInput(input)).toThrow(
        'mentorshipStatus must be one of'
      );
    });
  });

  describe('createCareerProfile', () => {
    it('should create a career profile', async () => {
      const input: CareerProfile.CareerProfileInput = {
        userId: 'user-1',
        speciality: 'Cardiology',
        preferredRoles: ['Surgeon', 'Consultant'],
        trainingCredits: 0,
      };

      const mockProfile = {
        id: 'profile-1',
        ...input,
        careerGoals: null,
        preferredRoles: input.preferredRoles || [],
        mentorshipStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.careerProfile.create as jest.Mock).mockResolvedValue(mockProfile);

      const result = await CareerProfile.createCareerProfile(mockPrisma, input);

      expect(result).toEqual(mockProfile);
      expect(mockPrisma.careerProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: input.userId },
      });
      expect(mockPrisma.careerProfile.create).toHaveBeenCalled();
    });

    it('should throw error if profile already exists', async () => {
      const input: CareerProfile.CareerProfileInput = {
        userId: 'user-1',
      };

      const existingProfile = {
        id: 'profile-1',
        userId: 'user-1',
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(existingProfile);

      await expect(CareerProfile.createCareerProfile(mockPrisma, input)).rejects.toThrow(
        'Career profile already exists'
      );
    });
  });

  describe('getCareerProfile', () => {
    it('should get career profile by userId', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
        speciality: 'Cardiology',
        careerGoals: null,
        preferredRoles: [],
        trainingCredits: 0,
        mentorshipStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);

      const result = await CareerProfile.getCareerProfile(mockPrisma, 'user-1');

      expect(result).toEqual(mockProfile);
      expect(mockPrisma.careerProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should return null if profile not found', async () => {
      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await CareerProfile.getCareerProfile(mockPrisma, 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('updateTrainingCredits', () => {
    it('should update training credits', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
        trainingCredits: 10,
        updatedAt: new Date(),
      };

      (mockPrisma.careerProfile.update as jest.Mock).mockResolvedValue(mockProfile);

      const result = await CareerProfile.updateTrainingCredits(mockPrisma, 'user-1', 10);

      expect(result).toEqual(mockProfile);
      expect(mockPrisma.careerProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { trainingCredits: 10 },
      });
    });

    it('should throw error if credits are negative', async () => {
      await expect(
        CareerProfile.updateTrainingCredits(mockPrisma, 'user-1', -1)
      ).rejects.toThrow('credits must be non-negative');
    });
  });

  describe('addTrainingCredits', () => {
    it('should add training credits', async () => {
      const existingProfile = {
        id: 'profile-1',
        userId: 'user-1',
        trainingCredits: 5,
      };

      const updatedProfile = {
        ...existingProfile,
        trainingCredits: 8,
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(existingProfile);
      (mockPrisma.careerProfile.update as jest.Mock).mockResolvedValue(updatedProfile);

      const result = await CareerProfile.addTrainingCredits(mockPrisma, 'user-1', 3);

      expect(result.trainingCredits).toBe(8);
    });

    it('should throw error if profile not found', async () => {
      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(CareerProfile.addTrainingCredits(mockPrisma, 'user-1', 5)).rejects.toThrow(
        'Career profile not found'
      );
    });

    it('should throw error if credits would go negative', async () => {
      const existingProfile = {
        id: 'profile-1',
        userId: 'user-1',
        trainingCredits: 2,
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(existingProfile);

      await expect(CareerProfile.addTrainingCredits(mockPrisma, 'user-1', -5)).rejects.toThrow(
        'Cannot reduce credits below zero'
      );
    });
  });
});

