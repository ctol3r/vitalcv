import { describe, expect, it } from '@jest/globals';
import {
  createSystemLoadMap,
  hasHighLoad,
  hasLowLoad,
  isOverloaded,
  type SystemLoadMap,
} from '../models/SystemLoadMap.js';

describe('SystemLoadMap', () => {
  const baseLoadMap: SystemLoadMap = {
    id: 'load-1',
    nodeId: 'node-1',
    loadScore: 0.5,
    computedAt: new Date('2025-01-01'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  describe('createSystemLoadMap', () => {
    it('should create a valid system load map', () => {
      const loadMap = createSystemLoadMap({
        id: 'load-1',
        nodeId: 'node-1',
        loadScore: 0.75,
      });

      expect(loadMap.id).toBe('load-1');
      expect(loadMap.nodeId).toBe('node-1');
      expect(loadMap.loadScore).toBe(0.75);
      expect(loadMap.computedAt).toBeInstanceOf(Date);
      expect(loadMap.createdAt).toBeInstanceOf(Date);
      expect(loadMap.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const loadMap = createSystemLoadMap({
        id: 'load-1',
        nodeId: 'node-1',
        loadScore: 0.75,
        orgId: 'org-1',
        forecastSource: 'demandForecast',
        mobilityFactor: 0.3,
        enrollmentCoverage: 0.9,
        metadata: { department: 'ED' },
      });

      expect(loadMap.orgId).toBe('org-1');
      expect(loadMap.forecastSource).toBe('demandForecast');
      expect(loadMap.mobilityFactor).toBe(0.3);
      expect(loadMap.enrollmentCoverage).toBe(0.9);
      expect(loadMap.metadata).toEqual({ department: 'ED' });
    });

    it('should reject loadScore outside 0-1 range', () => {
      expect(() =>
        createSystemLoadMap({
          id: 'load-1',
          nodeId: 'node-1',
          loadScore: 1.5,
        })
      ).toThrow();

      expect(() =>
        createSystemLoadMap({
          id: 'load-1',
          nodeId: 'node-1',
          loadScore: -0.1,
        })
      ).toThrow();
    });

    it('should reject invalid mobilityFactor range', () => {
      expect(() =>
        createSystemLoadMap({
          id: 'load-1',
          nodeId: 'node-1',
          loadScore: 0.5,
          mobilityFactor: 1.5,
        })
      ).toThrow();
    });

    it('should reject invalid enrollmentCoverage range', () => {
      expect(() =>
        createSystemLoadMap({
          id: 'load-1',
          nodeId: 'node-1',
          loadScore: 0.5,
          enrollmentCoverage: -0.1,
        })
      ).toThrow();
    });
  });

  describe('load score helpers', () => {
    it('should identify high load', () => {
      const highLoad = createSystemLoadMap({
        ...baseLoadMap,
        loadScore: 0.85,
      });
      expect(hasHighLoad(highLoad)).toBe(true);
      expect(hasHighLoad(highLoad, 0.9)).toBe(false);
    });

    it('should identify low load', () => {
      const lowLoad = createSystemLoadMap({
        ...baseLoadMap,
        loadScore: 0.2,
      });
      expect(hasLowLoad(lowLoad)).toBe(true);
      expect(hasLowLoad(lowLoad, 0.1)).toBe(false);
    });

    it('should identify overloaded systems', () => {
      const overloaded = createSystemLoadMap({
        ...baseLoadMap,
        loadScore: 0.95,
      });
      expect(isOverloaded(overloaded)).toBe(true);
      expect(isOverloaded(overloaded, 0.98)).toBe(false);
    });
  });
});

