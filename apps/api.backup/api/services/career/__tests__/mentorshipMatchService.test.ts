/**
 * B233A-CAREER-004: MentorshipMatchService Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { MentorshipMatchService } from '../mentorshipMatchService';
import * as CareerProfile from '../models/CareerProfile';

// Mock Prisma client
const mockPrisma = {
  careerProfile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  mentorship: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('MentorshipMatchService', () => {
  let service: MentorshipMatchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MentorshipMatchService(mockPrisma);
  });

  describe('findPotentialMentors', () => {
    it('should find potential mentors based on criteria', async () => {
      const mockMenteeProfile = {
        id: 'profile-1',
        userId: 'user-1',
        speciality: 'Cardiology',
        preferredRoles: ['Surgeon'],
        careerGoals: {
          targetRoles: ['Surgeon'],
        },
        trainingCredits: 0,
        mentorshipStatus: 'seeking',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMentorProfiles = [
        {
          id: 'profile-2',
          userId: 'user-2',
          speciality: 'Cardiology',
          preferredRoles: ['Surgeon', 'Consultant'],
          careerGoals: null,
          trainingCredits: 50,
          mentorshipStatus: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(mockMenteeProfile);
      (mockPrisma.careerProfile.findMany as jest.Mock).mockResolvedValue(mockMentorProfiles);
      (mockPrisma.mentorship.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findPotentialMentors('user-1', {
        speciality: 'Cardiology',
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].menteeId).toBe('profile-1');
      expect(result[0].matchScore).toBeGreaterThan(0);
    });

    it('should throw error if mentee profile not found', async () => {
      (mockPrisma.careerProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findPotentialMentors('user-1')).rejects.toThrow(
        'Career profile not found'
      );
    });
  });

  describe('createMentorshipMatch', () => {
    it('should create a mentorship match', async () => {
      const mockMenteeProfile = {
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

      const mockMentorProfile = {
        id: 'profile-2',
        userId: 'user-2',
        speciality: 'Cardiology',
        preferredRoles: ['Surgeon'],
        careerGoals: null,
        trainingCredits: 50,
        mentorshipStatus: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMentorship = {
        id: 'mentorship-1',
        menteeId: 'profile-1',
        mentorId: 'profile-2',
        status: 'pending',
        matchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockMenteeProfile)
        .mockResolvedValueOnce(mockMentorProfile);
      (mockPrisma.mentorship.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.mentorship.create as jest.Mock).mockResolvedValue(mockMentorship);
      (mockPrisma.careerProfile.update as jest.Mock).mockResolvedValue(mockMenteeProfile);

      const result = await service.createMentorshipMatch('user-1', 'user-2');

      expect(result.mentorshipId).toBe('mentorship-1');
      expect(result.menteeId).toBe('profile-1');
      expect(result.mentorId).toBe('profile-2');
      expect(result.status).toBe('pending');
    });

    it('should throw error if mentorship already exists', async () => {
      const mockMenteeProfile = {
        id: 'profile-1',
        userId: 'user-1',
      };

      const mockMentorProfile = {
        id: 'profile-2',
        userId: 'user-2',
      };

      const existingMentorship = {
        id: 'mentorship-1',
        menteeId: 'profile-1',
        mentorId: 'profile-2',
      };

      (mockPrisma.careerProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockMenteeProfile)
        .mockResolvedValueOnce(mockMentorProfile);
      (mockPrisma.mentorship.findUnique as jest.Mock).mockResolvedValue(existingMentorship);

      await expect(service.createMentorshipMatch('user-1', 'user-2')).rejects.toThrow(
        'Mentorship relationship already exists'
      );
    });
  });

  describe('acceptMentorship', () => {
    it('should accept a mentorship request', async () => {
      const mockMentorship = {
        id: 'mentorship-1',
        menteeId: 'profile-1',
        mentorId: 'profile-2',
        status: 'pending',
        mentor: {
          userId: 'user-2',
        },
        mentee: {
          userId: 'user-1',
        },
      };

      (mockPrisma.mentorship.findUnique as jest.Mock).mockResolvedValue(mockMentorship);
      (mockPrisma.mentorship.update as jest.Mock).mockResolvedValue({
        ...mockMentorship,
        status: 'accepted',
        acceptedAt: new Date(),
      });
      (mockPrisma.careerProfile.update as jest.Mock).mockResolvedValue({});

      await service.acceptMentorship('mentorship-1', 'user-2');

      expect(mockPrisma.mentorship.update).toHaveBeenCalled();
      expect(mockPrisma.careerProfile.update).toHaveBeenCalledTimes(2);
    });

    it('should throw error if not the mentor', async () => {
      const mockMentorship = {
        id: 'mentorship-1',
        mentor: {
          userId: 'user-2',
        },
      };

      (mockPrisma.mentorship.findUnique as jest.Mock).mockResolvedValue(mockMentorship);

      await expect(service.acceptMentorship('mentorship-1', 'user-1')).rejects.toThrow(
        'Only the mentor can accept'
      );
    });
  });
});

