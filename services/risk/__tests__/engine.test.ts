/**
 * Tests for risk scoring engine
 */

import { computeRiskScore, storeRiskScore } from '../engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Risk Scoring Engine', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.riskScore.deleteMany({});
    await prisma.clientFingerprint.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('computeRiskScore', () => {
    it('should return low risk score for normal request', async () => {
      const result = await computeRiskScore({
        deviceId: 'test-device-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        route: 'login',
        requestHistory: [
          {
            timestamp: new Date(),
            route: 'login',
          },
        ],
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThan(50);
      expect(result.reasonTags).toEqual([]);
    });

    it('should detect high velocity', async () => {
      const now = new Date();
      const requestHistory = Array.from({ length: 25 }, (_, i) => ({
        timestamp: new Date(now.getTime() - i * 1000), // 1 second apart
        route: 'login',
      }));

      const result = await computeRiskScore({
        deviceId: 'test-device-2',
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0',
        route: 'login',
        requestHistory,
      });

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.reasonTags).toContain('HIGH_VELOCITY');
    });

    it('should detect suspicious user agent', async () => {
      const result = await computeRiskScore({
        deviceId: 'test-device-3',
        ipAddress: '192.168.1.3',
        userAgent: 'bot',
        route: 'login',
      });

      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.reasonTags).toContain('SUSPICIOUS_UA');
    });

    it('should detect multiple accounts per device', async () => {
      // Create multiple fingerprints with different userIds
      await prisma.clientFingerprint.createMany({
        data: [
          {
            deviceId: 'test-device-4',
            userId: 'user-1',
            signals: {},
          },
          {
            deviceId: 'test-device-4',
            userId: 'user-2',
            signals: {},
          },
          {
            deviceId: 'test-device-4',
            userId: 'user-3',
            signals: {},
          },
        ],
      });

      const result = await computeRiskScore({
        deviceId: 'test-device-4',
        ipAddress: '192.168.1.4',
        userAgent: 'Mozilla/5.0',
        route: 'login',
      });

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.reasonTags).toContain('MULTIPLE_ACCOUNTS');
    });
  });

  describe('storeRiskScore', () => {
    it('should create new risk score', async () => {
      await storeRiskScore('test-device-5', '192.168.1.5', {
        score: 50,
        reasonTags: ['HIGH_VELOCITY'],
      });

      const stored = await prisma.riskScore.findUnique({
        where: {
          deviceId_ipHash: {
            deviceId: 'test-device-5',
            ipHash: expect.any(String),
          },
        },
      });

      expect(stored).toBeTruthy();
      expect(stored?.score).toBe(50);
      expect(stored?.reasonTags).toContain('HIGH_VELOCITY');
    });

    it('should update existing risk score', async () => {
      const ipHash = 'test-ip-hash';
      await prisma.riskScore.create({
        data: {
          deviceId: 'test-device-6',
          ipHash,
          score: 30,
          reasonTags: [],
        },
      });

      await storeRiskScore('test-device-6', '192.168.1.6', {
        score: 70,
        reasonTags: ['HIGH_VELOCITY', 'SUSPICIOUS_UA'],
      });

      const stored = await prisma.riskScore.findUnique({
        where: {
          deviceId_ipHash: {
            deviceId: 'test-device-6',
            ipHash: expect.any(String),
          },
        },
      });

      expect(stored?.score).toBe(70);
      expect(stored?.reasonTags).toContain('HIGH_VELOCITY');
      expect(stored?.reasonTags).toContain('SUSPICIOUS_UA');
    });
  });
});

