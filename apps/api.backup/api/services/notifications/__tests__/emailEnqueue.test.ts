/**
 * B148A-NOTIF-006: Unit tests for Email Enqueue Helper
 *
 * Tests for enqueueEmail function (inserts EmailDelivery row, no actual send).
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { enqueueEmail } from '../emailEnqueue.js';
import { EmailDeliveryStatus } from '../models/EmailDelivery.js';

const infoMock = jest.fn();

jest.mock('../logging/serviceLogger', () => ({
  getServiceLogger: jest.fn(() => ({
    info: infoMock,
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  })),
}));

// Mock Prisma Client
const mockPrisma = {
  emailDelivery: {
    create: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

describe('Email Enqueue Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should enqueue email with all fields', async () => {
    const to = 'test@example.com';
    const templateId = 'welcome-email';
    const payload = { subject: 'Welcome!', name: 'John' };

    mockPrisma.emailDelivery.create.mockResolvedValue({
      id: 'email-123',
      to,
      subject: payload.subject,
      templateId,
      payload,
      status: EmailDeliveryStatus.PENDING,
      createdAt: new Date(),
    });

    const result = await enqueueEmail(to, templateId, payload);

    expect(result.id).toBe('email-123');
    expect(result.subject).toBe('Welcome!');
    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith({
      data: {
        to,
        subject: payload.subject,
        templateId,
        payload,
        status: EmailDeliveryStatus.PENDING,
      },
    });

    expect(infoMock).toHaveBeenCalledWith(
      'Queued email for delivery',
      expect.objectContaining({
        to,
        subject: payload.subject,
      }),
    );
  });

  it('should use default subject if not in payload', async () => {
    const to = 'test@example.com';
    const payload = { name: 'John' }; // No subject

    mockPrisma.emailDelivery.create.mockResolvedValue({
      id: 'email-123',
      to,
      subject: 'Notification',
      templateId: null,
      payload,
      status: EmailDeliveryStatus.PENDING,
      createdAt: new Date(),
    });

    await enqueueEmail(to, undefined, payload);

    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith({
      data: {
        to,
        subject: 'Notification',
        templateId: null,
        payload,
        status: EmailDeliveryStatus.PENDING,
      },
    });
  });

  it('should handle email without templateId', async () => {
    const to = 'test@example.com';
    const payload = { subject: 'Test' };

    mockPrisma.emailDelivery.create.mockResolvedValue({
      id: 'email-123',
      to,
      subject: 'Test',
      templateId: null,
      payload,
      status: EmailDeliveryStatus.PENDING,
      createdAt: new Date(),
    });

    await enqueueEmail(to, undefined, payload);

    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: null,
        }),
      })
    );
  });

  it('should throw error for invalid email input', async () => {
    await expect(enqueueEmail('invalid-email', undefined, {})).rejects.toThrow(
      'Invalid email input'
    );
  });
});

