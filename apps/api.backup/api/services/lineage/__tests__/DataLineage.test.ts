/**
 * Tests for DataLineageService
 * B228A-LIN-001: DataLineage model tests
 */

import { DataLineageService } from '../models/DataLineage';
import { PrismaClient, OperationType } from '@prisma/client';

describe('DataLineageService', () => {
  let service: DataLineageService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new DataLineageService(prisma);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.dataLineage.deleteMany({
      where: {
        sourceRecordId: {
          startsWith: 'test_',
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('createLineage', () => {
    it('should create a lineage entry with all fields', async () => {
      const input = {
        sourceSystem: 'credentials',
        sourceRecordId: 'test_source_123',
        targetRecordId: 'test_target_456',
        operationType: OperationType.CREATE,
        operatorId: 'test_operator_789',
        transformationId: null,
        metadata: { chainId: 'polkadot', network: 'mainnet' },
      };

      const lineage = await service.createLineage(input);

      expect(lineage).toBeDefined();
      expect(lineage.sourceSystem).toBe(input.sourceSystem);
      expect(lineage.sourceRecordId).toBe(input.sourceRecordId);
      expect(lineage.targetRecordId).toBe(input.targetRecordId);
      expect(lineage.operationType).toBe(input.operationType);
      expect(lineage.operatorId).toBe(input.operatorId);
      expect(lineage.metadata).toEqual(input.metadata);
    });

    it('should create a lineage entry with minimal fields', async () => {
      const input = {
        sourceSystem: 'reputation',
        sourceRecordId: 'test_source_123',
        targetRecordId: 'test_target_456',
        operationType: OperationType.UPDATE,
      };

      const lineage = await service.createLineage(input);

      expect(lineage).toBeDefined();
      expect(lineage.sourceSystem).toBe(input.sourceSystem);
      expect(lineage.operatorId).toBeNull();
      expect(lineage.transformationId).toBeNull();
    });

    it('should handle all operation types', async () => {
      const operations = [OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE];

      for (const opType of operations) {
        const input = {
          sourceSystem: 'finance',
          sourceRecordId: `test_source_${opType}`,
          targetRecordId: `test_target_${opType}`,
          operationType: opType,
        };

        const lineage = await service.createLineage(input);
        expect(lineage.operationType).toBe(opType);
      }
    });
  });

  describe('queryLineage', () => {
    beforeEach(async () => {
      // Create test data
      await service.createLineage({
        sourceSystem: 'credentials',
        sourceRecordId: 'test_source_1',
        targetRecordId: 'test_target_1',
        operationType: OperationType.CREATE,
        operatorId: 'test_operator_1',
      });

      await service.createLineage({
        sourceSystem: 'reputation',
        sourceRecordId: 'test_source_2',
        targetRecordId: 'test_target_2',
        operationType: OperationType.UPDATE,
        operatorId: 'test_operator_2',
      });

      await service.createLineage({
        sourceSystem: 'credentials',
        sourceRecordId: 'test_source_3',
        targetRecordId: 'test_target_3',
        operationType: OperationType.DELETE,
        operatorId: 'test_operator_1',
      });
    });

    it('should query by sourceSystem', async () => {
      const results = await service.queryLineage({ sourceSystem: 'credentials' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.sourceSystem === 'credentials')).toBe(true);
    });

    it('should query by sourceRecordId', async () => {
      const results = await service.queryLineage({ sourceRecordId: 'test_source_1' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sourceRecordId).toBe('test_source_1');
    });

    it('should query by operationType', async () => {
      const results = await service.queryLineage({ operationType: OperationType.CREATE });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.operationType === OperationType.CREATE)).toBe(true);
    });

    it('should query by operatorId', async () => {
      const results = await service.queryLineage({ operatorId: 'test_operator_1' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.operatorId === 'test_operator_1')).toBe(true);
    });

    it('should respect limit and offset', async () => {
      const results1 = await service.queryLineage({ limit: 1, offset: 0 });
      const results2 = await service.queryLineage({ limit: 1, offset: 1 });

      expect(results1.length).toBe(1);
      expect(results2.length).toBe(1);
      expect(results1[0].id).not.toBe(results2[0].id);
    });

    it('should filter by date range', async () => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 1);
      const endDate = new Date();
      endDate.setHours(endDate.getHours() + 1);

      const results = await service.queryLineage({ startDate, endDate });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(r.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });
  });

  describe('getForwardLineage', () => {
    beforeEach(async () => {
      // Create chain: source -> target1 -> target2
      await service.createLineage({
        sourceSystem: 'credentials',
        sourceRecordId: 'test_source',
        targetRecordId: 'test_target_1',
        operationType: OperationType.CREATE,
      });

      await service.createLineage({
        sourceSystem: 'credentials',
        sourceRecordId: 'test_target_1',
        targetRecordId: 'test_target_2',
        operationType: OperationType.UPDATE,
      });
    });

    it('should get forward lineage (what was created from this record)', async () => {
      const results = await service.getForwardLineage('test_source');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.targetRecordId === 'test_target_1')).toBe(true);
    });
  });

  describe('getBackwardLineage', () => {
    beforeEach(async () => {
      // Create chain: source -> target
      await service.createLineage({
        sourceSystem: 'reputation',
        sourceRecordId: 'test_source',
        targetRecordId: 'test_target',
        operationType: OperationType.CREATE,
      });
    });

    it('should get backward lineage (what created this record)', async () => {
      const results = await service.getBackwardLineage('test_target');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.sourceRecordId === 'test_source')).toBe(true);
    });
  });

  describe('getFullLineage', () => {
    beforeEach(async () => {
      // Create bidirectional chain
      await service.createLineage({
        sourceSystem: 'finance',
        sourceRecordId: 'test_source',
        targetRecordId: 'test_target',
        operationType: OperationType.CREATE,
      });

      await service.createLineage({
        sourceSystem: 'finance',
        sourceRecordId: 'test_target',
        targetRecordId: 'test_target_2',
        operationType: OperationType.UPDATE,
      });
    });

    it('should get both forward and backward lineage', async () => {
      const result = await service.getFullLineage('test_target');

      expect(result.forward).toBeDefined();
      expect(result.backward).toBeDefined();
      expect(result.forward.length).toBeGreaterThan(0);
      expect(result.backward.length).toBeGreaterThan(0);
    });
  });
});

