/**
 * B148A-NOTIF-009: Unit tests for Demo Email Sender Stub
 *
 * Tests for processPendingEmails function.
 * Verifies that PENDING emails are loaded, logged, and marked as SENT.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  processPendingEmails,
  runEmailSenderJob,
} from '../emailSenderStub.js';
import { EmailDeliveryStatus } from '../models/EmailDelivery.js';

const infoMock = jest.fn();
const errorMock = jest.fn();

jest.mock('../logging/serviceLogger', () => ({
  getServiceLogger: jest.fn(() => ({
    info: infoMock,
    error: errorMock,
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  })),
}));

// Mock Prisma Client
const mockPrisma = {
  emailDelivery: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

describe('Email Sender Stub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process pending emails and mark as SENT', async () => {
    const pendingEmails = [
      {
        id: 'email-1',
        to: 'user1@example.com',
        subject: 'Test Email 1',
        templateId: 'template-1',
        payload: { name: 'User 1' },
        status: EmailDeliveryStatus.PENDING,
        createdAt: new Date('2025-01-01'),
      },
      {
        id: 'email-2',
        to: 'user2@example.com',
        subject: 'Test Email 2',
        templateId: null,
        payload: { name: 'User 2' },
        status: EmailDeliveryStatus.PENDING,
        createdAt: new Date('2025-01-02'),
      },
    ];

    mockPrisma.emailDelivery.findMany.mockResolvedValue(pendingEmails);
    mockPrisma.emailDelivery.update.mockImplementation(async (args: any) => ({
      ...pendingEmails.find((e) => e.id === args.where.id),
      status: EmailDeliveryStatus.SENT,
      sentAt: new Date(),
    }));

    const result = await processPendingEmails(10);

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockPrisma.emailDelivery.findMany).toHaveBeenCalledWith({
      where: {
        status: EmailDeliveryStatus.PENDING,
      },
      take: 10,
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Verify all emails were marked as SENT
    expect(mockPrisma.emailDelivery.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.emailDelivery.update).toHaveBeenCalledWith({
      where: { id: 'email-1' },
      data: {
        status: EmailDeliveryStatus.SENT,
        sentAt: expect.any(Date),
      },
    });

    // Verify stub logging
    expect(infoMock).toHaveBeenCalledWith(
      'Email sender stub would send email',
      expect.objectContaining({
        to: 'user1@example.com',
      }),
    );
  });

  it('should return zero counts when no pending emails', async () => {
    mockPrisma.emailDelivery.findMany.mockResolvedValue([]);

    const result = await processPendingEmails(10);

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockPrisma.emailDelivery.update).not.toHaveBeenCalled();
  });

  it('should handle errors and mark emails as FAILED', async () => {
    const pendingEmail = {
      id: 'email-error',
      to: 'error@example.com',
      subject: 'Error Email',
      templateId: null,
      payload: {},
      status: EmailDeliveryStatus.PENDING,
      createdAt: new Date(),
    };

    mockPrisma.emailDelivery.findMany.mockResolvedValue([pendingEmail]);
    mockPrisma.emailDelivery.update.mockRejectedValueOnce(
      new Error('Database error')
    );

    const result = await processPendingEmails(10);

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);

    // Verify error logging
    expect(errorMock).toHaveBeenCalledWith(
      'Failed to process email',
      expect.objectContaining({
        emailId: 'email-error',
      }),
    );

    // Verify email was marked as FAILED
    expect(mockPrisma.emailDelivery.update).toHaveBeenCalledWith({
      where: { id: 'email-error' },
      data: {
        status: EmailDeliveryStatus.FAILED,
        lastError: 'Database error',
      },
    });
  });

  it('should respect batch size limit', async () => {
    const manyEmails = Array.from({ length: 20 }, (_, i) => ({
      id: `email-${i}`,
      to: `user${i}@example.com`,
      subject: `Email ${i}`,
      templateId: null,
      payload: {},
      status: EmailDeliveryStatus.PENDING,
      createdAt: new Date(),
    }));

    mockPrisma.emailDelivery.findMany.mockResolvedValue(manyEmails.slice(0, 5));
    mockPrisma.emailDelivery.update.mockImplementation(async (args: any) => ({
      ...manyEmails.find((e) => e.id === args.where.id),
      status: EmailDeliveryStatus.SENT,
      sentAt: new Date(),
    }));

    const result = await processPendingEmails(5);

    expect(result.processed).toBe(5);
    expect(mockPrisma.emailDelivery.findMany).toHaveBeenCalledWith({
      where: {
        status: EmailDeliveryStatus.PENDING,
      },
      take: 5, // Batch size
      orderBy: {
        createdAt: 'asc',
      },
    });
  });

  it('should process oldest emails first', async () => {
    const emails = [
      {
        id: 'email-new',
        to: 'new@example.com',
        subject: 'New',
        templateId: null,
        payload: {},
        status: EmailDeliveryStatus.PENDING,
        createdAt: new Date('2025-01-03'),
      },
      {
        id: 'email-old',
        to: 'old@example.com',
        subject: 'Old',
        templateId: null,
        payload: {},
        status: EmailDeliveryStatus.PENDING,
        createdAt: new Date('2025-01-01'),
      },
    ];

    // Should return oldest first (ascending by createdAt)
    mockPrisma.emailDelivery.findMany.mockResolvedValue([
      emails[1],
      emails[0],
    ]);
    mockPrisma.emailDelivery.update.mockImplementation(async (args: any) => ({
      ...emails.find((e) => e.id === args.where.id),
      status: EmailDeliveryStatus.SENT,
      sentAt: new Date(),
    }));

    await processPendingEmails(10);

    // Verify orderBy was set correctly
    expect(mockPrisma.emailDelivery.findMany).toHaveBeenCalledWith({
      where: {
        status: EmailDeliveryStatus.PENDING,
      },
      take: 10,
      orderBy: {
        createdAt: 'asc',
      },
    });
  });

  it('should run email sender job and log results', async () => {
    mockPrisma.emailDelivery.findMany.mockResolvedValue([]);

    await runEmailSenderJob();

    expect(infoMock).toHaveBeenCalledWith('Starting email sender job');
    expect(infoMock).toHaveBeenCalledWith('Email sender job complete', {
      failed: 0,
      processed: 0,
    });
  });
});

