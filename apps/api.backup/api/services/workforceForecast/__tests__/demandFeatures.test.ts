/**
 * Tests for DemandFeatureExtractor
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DemandFeatureExtractor } from '../extractors/demandFeatures.js';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  demandTimeSeries: {
    findMany: jest.fn(),
  },
} as any;

describe('DemandFeatureExtractor', () => {
  let extractor: DemandFeatureExtractor;

  beforeEach(() => {
    extractor = new DemandFeatureExtractor(mockPrisma as any);
    jest.clearAllMocks();
  });

  it('should extract basic temporal features', async () => {
    const testDate = new Date('2024-01-15'); // Monday, January 15
    mockPrisma.demandTimeSeries.findMany.mockResolvedValue([
      { date: new Date('2024-01-14'), shiftCount: 10, volume: 100, acuityLevel: 5.0, metadata: null },
      { date: new Date('2024-01-15'), shiftCount: 12, volume: 120, acuityLevel: 5.5, metadata: null },
    ]);

    const features = await extractor.extractFeatures(testDate);

    expect(features.dayOfWeek).toBe(1); // Monday
    expect(features.dayOfMonth).toBe(15);
    expect(features.month).toBe(1);
    expect(features.quarter).toBe(1);
    expect(features.isWeekend).toBe(false);
  });

  it('should extract lag features', async () => {
    const testDate = new Date('2024-01-15');
    const historicalData = [];
    for (let i = 0; i < 100; i++) {
      historicalData.push({
        date: new Date(2024, 0, 1 + i),
        shiftCount: 10 + (i % 7),
        volume: 100 + (i % 7) * 10,
        acuityLevel: 5.0,
        metadata: null,
      });
    }
    mockPrisma.demandTimeSeries.findMany.mockResolvedValue(historicalData);

    const features = await extractor.extractFeatures(testDate);

    expect(features.lag1Day).toBeDefined();
    expect(features.lag7Day).toBeDefined();
  });

  it('should extract rolling statistics', async () => {
    const testDate = new Date('2024-01-15');
    const historicalData = [];
    for (let i = 0; i < 30; i++) {
      historicalData.push({
        date: new Date(2024, 0, 1 + i),
        shiftCount: 10,
        volume: 100,
        acuityLevel: 5.0,
        metadata: null,
      });
    }
    mockPrisma.demandTimeSeries.findMany.mockResolvedValue(historicalData);

    const features = await extractor.extractFeatures(testDate);

    expect(features.rollingMean7Day).toBeDefined();
    expect(features.rollingMean30Day).toBeDefined();
    expect(features.rollingStd7Day).toBeDefined();
    expect(features.rollingStd30Day).toBeDefined();
  });

  it('should detect holidays', async () => {
    const newYearsDate = new Date('2024-01-01');
    mockPrisma.demandTimeSeries.findMany.mockResolvedValue([]);

    const features = await extractor.extractFeatures(newYearsDate);

    expect(features.isHoliday).toBe(true);
  });

  it('should extract backlog indicator from metadata', async () => {
    const testDate = new Date('2024-01-15');
    const historicalData = [
      {
        date: new Date('2024-01-14'),
        shiftCount: 10,
        volume: 100,
        acuityLevel: 5.0,
        metadata: { backlog: 5 },
      },
      {
        date: new Date('2024-01-15'),
        shiftCount: 12,
        volume: 120,
        acuityLevel: 5.5,
        metadata: { backlog: 7 },
      },
    ];
    mockPrisma.demandTimeSeries.findMany.mockResolvedValue(historicalData);

    const features = await extractor.extractFeatures(testDate);

    expect(features.backlogIndicator).toBeDefined();
    expect(features.backlogIndicator).toBeGreaterThan(0);
  });
});

