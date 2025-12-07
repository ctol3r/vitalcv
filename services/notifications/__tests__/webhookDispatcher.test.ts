/**
 * B148A-NOTIF-008: Unit tests for Webhook Dispatcher
 *
 * Tests for dispatchWebhook function (finds subscriptions, POSTs JSON with HMAC signature).
 * In MVP, network calls are stubbed.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { dispatchWebhook, testHmacSignature } from '../webhookDispatcher.js';

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
  webhookSubscription: {
    findMany: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

describe('Webhook Dispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should dispatch webhook to active subscriptions', async () => {
    const eventType = 'ApplicationCreated';
    const orgId = 'org-123';
    const payload = { applicationId: 'app-456', jobId: 'job-789' };

    const subscriptions = [
      {
        id: 'sub-1',
        orgId,
        eventType,
        targetUrl: 'https://example.com/webhook',
        secret: 'secret-key-1',
        isActive: true,
      },
    ];

    mockPrisma.webhookSubscription.findMany.mockResolvedValue(subscriptions);

    const result = await dispatchWebhook(eventType, orgId, payload);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockPrisma.webhookSubscription.findMany).toHaveBeenCalledWith({
      where: {
        eventType,
        orgId,
        isActive: true,
      },
    });

    // Verify stub logging
    expect(infoMock).toHaveBeenCalledWith(
      'Webhook dispatcher stub call',
      expect.objectContaining({
        eventType,
        orgId,
      }),
    );
  });

  it('should handle multiple subscriptions', async () => {
    const eventType = 'PrivilegeApproved';
    const orgId = 'org-123';
    const payload = { privilegeRequestId: 'priv-456' };

    const subscriptions = [
      {
        id: 'sub-1',
        orgId,
        eventType,
        targetUrl: 'https://example.com/webhook1',
        secret: 'secret-1',
        isActive: true,
      },
      {
        id: 'sub-2',
        orgId,
        eventType,
        targetUrl: 'https://example.com/webhook2',
        secret: 'secret-2',
        isActive: true,
      },
    ];

    mockPrisma.webhookSubscription.findMany.mockResolvedValue(subscriptions);

    const result = await dispatchWebhook(eventType, orgId, payload);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('should return zero counts when no subscriptions found', async () => {
    mockPrisma.webhookSubscription.findMany.mockResolvedValue([]);

    const result = await dispatchWebhook('SomeEvent', 'org-123', {});

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(infoMock).toHaveBeenCalledWith('No webhook subscriptions found', {
      eventType: 'SomeEvent',
      orgId: 'org-123',
    });
  });

  it('should only find active subscriptions', async () => {
    const subscriptions = [
      {
        id: 'sub-1',
        orgId: 'org-123',
        eventType: 'TestEvent',
        targetUrl: 'https://example.com/webhook',
        secret: 'secret',
        isActive: true,
      },
      {
        id: 'sub-2',
        orgId: 'org-123',
        eventType: 'TestEvent',
        targetUrl: 'https://example.com/webhook2',
        secret: 'secret2',
        isActive: false, // Inactive
      },
    ];

    mockPrisma.webhookSubscription.findMany.mockResolvedValue(
      subscriptions.filter((s) => s.isActive)
    );

    const result = await dispatchWebhook('TestEvent', 'org-123', {});

    expect(result.sent).toBe(1); // Only active subscription
  });

  describe('HMAC signature calculation', () => {
    it('should calculate HMAC signature correctly', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';

      const signature = testHmacSignature(payload, secret);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should produce same signature for same input', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';

      const sig1 = testHmacSignature(payload, secret);
      const sig2 = testHmacSignature(payload, secret);

      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different secrets', () => {
      const payload = '{"test": "data"}';

      const sig1 = testHmacSignature(payload, 'secret-1');
      const sig2 = testHmacSignature(payload, 'secret-2');

      expect(sig1).not.toBe(sig2);
    });
  });
});

