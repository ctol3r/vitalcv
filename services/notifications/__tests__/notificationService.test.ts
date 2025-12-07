/**
 * B148A-NOTIF-002: Unit tests for Notification Service
 *
 * Tests for createNotification and markRead functions.
 * Can run with in-memory or DB test setup.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  createNotification,
  markRead,
  listNotifications,
} from '../notificationService.js';

// Mock Prisma Client for testing
// In a real test setup, you'd use an in-memory database or test database
const mockPrisma = {
  notification: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  featureFlag: {
    findUnique: jest.fn(),
  },
  orgFeatureFlag: {
    findUnique: jest.fn(),
  },
  userFeatureFlag: {
    findUnique: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock feature flag check
jest.mock('../flags/featureFlags.js', () => ({
  checkFeatureFlag: jest.fn().mockResolvedValue(true),
}));

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      const userId = 'user-123';
      const type = 'APPLICATION_SUBMITTED';
      const payload = { applicationId: 'app-456', jobTitle: 'Nurse' };

      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-789',
        userId,
        orgId: null,
        type,
        payload,
        read: false,
        readAt: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      });

      const result = await createNotification(userId, type, payload);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(userId);
      expect(result?.type).toBe(type);
      expect(result?.read).toBe(false);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId,
          type,
          payload,
          read: false,
        },
      });
    });

    it('should return null when notifications feature is disabled', async () => {
      const { checkFeatureFlag } = require('../flags/featureFlags.js');
      checkFeatureFlag.mockResolvedValueOnce(false);

      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      const result = await createNotification('user-123', 'TEST', {});

      expect(result).toBeNull();
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NotificationService] Notifications disabled'),
        expect.objectContaining({ userId: 'user-123', type: 'TEST' })
      );

      consoleInfoSpy.mockRestore();
    });

    it('should throw error for invalid input', async () => {
      await expect(
        createNotification('', 'TEST', {})
      ).rejects.toThrow('Invalid notification input');
    });
  });

  describe('markRead', () => {
    it('should mark notification as read', async () => {
      const id = 'notif-123';
      const userId = 'user-456';
      const notification = {
        id,
        userId,
        type: 'PRIVILEGE_APPROVED',
        payload: {},
        read: false,
        readAt: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      mockPrisma.notification.findFirst.mockResolvedValue(notification);
      mockPrisma.notification.update.mockResolvedValue({
        ...notification,
        read: true,
        readAt: new Date('2025-01-02'),
      });

      const result = await markRead(id, userId);

      expect(result.read).toBe(true);
      expect(result.readAt).toBeDefined();
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should return existing notification if already read', async () => {
      const id = 'notif-123';
      const userId = 'user-456';
      const alreadyReadNotification = {
        id,
        userId,
        type: 'PRIVILEGE_APPROVED',
        payload: {},
        read: true,
        readAt: new Date('2025-01-01'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      mockPrisma.notification.findFirst.mockResolvedValue(alreadyReadNotification);

      const result = await markRead(id, userId);

      expect(result.read).toBe(true);
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('should throw error if notification not found or not owned', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(markRead('notif-123', 'user-456')).rejects.toThrow(
        'Notification not found or not owned by user'
      );
    });
  });

  describe('listNotifications', () => {
    it('should list notifications with unread first', async () => {
      const userId = 'user-123';
      const notifications = [
        {
          id: 'notif-1',
          userId,
          type: 'UNREAD',
          payload: {},
          read: false,
          readAt: null,
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
        },
        {
          id: 'notif-2',
          userId,
          type: 'READ',
          payload: {},
          read: true,
          readAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.notification.findMany.mockResolvedValue(notifications);

      const result = await listNotifications(userId);

      expect(result).toHaveLength(2);
      expect(result[0].read).toBe(false); // Unread first
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [
          { read: 'asc' },
          { createdAt: 'desc' },
        ],
        take: 50,
      });
    });

    it('should filter only unread notifications when onlyUnread=true', async () => {
      const userId = 'user-123';
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await listNotifications(userId, { onlyUnread: true });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          read: false,
        },
        orderBy: [
          { read: 'asc' },
          { createdAt: 'desc' },
        ],
        take: 50,
      });
    });

    it('should respect limit parameter', async () => {
      const userId = 'user-123';
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await listNotifications(userId, { limit: 25 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
        })
      );
    });

    it('should cap limit at 100', async () => {
      const userId = 'user-123';
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await listNotifications(userId, { limit: 200 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });
});

