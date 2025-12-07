import { describe, expect, it } from '@jest/globals';
import {
  createCouplingEdge,
  isDependsOnEdge,
  isFeedsIntoEdge,
  isBlocksEdge,
  isAmplifiesEdge,
  isCausesEdge,
  isDegradesEdge,
  isStrengthensEdge,
  hasHighImpact,
  hasLowImpact,
  type CouplingEdge,
} from '../models/CouplingEdge.js';

describe('CouplingEdge', () => {
  const baseEdge: CouplingEdge = {
    id: 'edge-1',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    edgeType: 'DEPENDS_ON',
    impactWeight: 0.5,
    delayFactor: 1.0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  describe('createCouplingEdge', () => {
    it('should create a valid coupling edge', () => {
      const edge = createCouplingEdge({
        id: 'edge-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        edgeType: 'DEPENDS_ON',
        impactWeight: 0.5,
        delayFactor: 1.0,
      });

      expect(edge.id).toBe('edge-1');
      expect(edge.sourceNodeId).toBe('node-1');
      expect(edge.targetNodeId).toBe('node-2');
      expect(edge.edgeType).toBe('DEPENDS_ON');
      expect(edge.impactWeight).toBe(0.5);
      expect(edge.delayFactor).toBe(1.0);
      expect(edge.createdAt).toBeInstanceOf(Date);
      expect(edge.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept optional metadata', () => {
      const edge = createCouplingEdge({
        id: 'edge-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        edgeType: 'DEPENDS_ON',
        impactWeight: 0.5,
        delayFactor: 1.0,
        metadata: { rationale: 'Critical dependency' },
      });

      expect(edge.metadata).toEqual({ rationale: 'Critical dependency' });
    });

    it('should reject invalid edge type', () => {
      expect(() =>
        createCouplingEdge({
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'INVALID_TYPE' as any,
          impactWeight: 0.5,
          delayFactor: 1.0,
        })
      ).toThrow();
    });

    it('should reject impactWeight outside 0-1 range', () => {
      expect(() =>
        createCouplingEdge({
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'DEPENDS_ON',
          impactWeight: 1.5,
          delayFactor: 1.0,
        })
      ).toThrow();

      expect(() =>
        createCouplingEdge({
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'DEPENDS_ON',
          impactWeight: -0.1,
          delayFactor: 1.0,
        })
      ).toThrow();
    });

    it('should reject negative delayFactor', () => {
      expect(() =>
        createCouplingEdge({
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'DEPENDS_ON',
          impactWeight: 0.5,
          delayFactor: -1.0,
        })
      ).toThrow();
    });
  });

  describe('edge type predicates', () => {
    it('should identify DEPENDS_ON edges', () => {
      const edge = createCouplingEdge({
        ...baseEdge,
        edgeType: 'DEPENDS_ON',
      });
      expect(isDependsOnEdge(edge)).toBe(true);
      expect(isFeedsIntoEdge(edge)).toBe(false);
    });

    it('should identify FEEDS_INTO edges', () => {
      const edge = createCouplingEdge({
        ...baseEdge,
        edgeType: 'FEEDS_INTO',
      });
      expect(isFeedsIntoEdge(edge)).toBe(true);
    });

    it('should identify BLOCKS edges', () => {
      const edge = createCouplingEdge({
        ...baseEdge,
        edgeType: 'BLOCKS',
      });
      expect(isBlocksEdge(edge)).toBe(true);
    });

    it('should identify AMPLIFIES edges', () => {
      const edge = createCouplingEdge({
        ...baseEdge,
        edgeType: 'AMPLIFIES',
      });
      expect(isAmplifiesEdge(edge)).toBe(true);
    });

    it('should identify CAUSES edges', () => {
      const edge = createCouplingEdge({
        ...baseEdge,
        edgeType: 'CAUSES',
      });
      expect(isCausesEdge(edge)).toBe(true);
    });

    it('should identify DEGRADES edges', () => {
      const edge = createCouplingEdge({
        ...baseEdge,
        edgeType: 'DEGRADES',
      });
      expect(isDegradesEdge(edge)).toBe(true);
    });

    it('should identify STRENGTHENS edges', () => {
      const edge = createCouplingEdge({
        ...baseEdge,
        edgeType: 'STRENGTHENS',
      });
      expect(isStrengthensEdge(edge)).toBe(true);
    });
  });

  describe('impact weight helpers', () => {
    it('should identify high impact edges', () => {
      const highImpactEdge = createCouplingEdge({
        ...baseEdge,
        impactWeight: 0.8,
      });
      expect(hasHighImpact(highImpactEdge)).toBe(true);
      expect(hasHighImpact(highImpactEdge, 0.9)).toBe(false);
    });

    it('should identify low impact edges', () => {
      const lowImpactEdge = createCouplingEdge({
        ...baseEdge,
        impactWeight: 0.2,
      });
      expect(hasLowImpact(lowImpactEdge)).toBe(true);
      expect(hasLowImpact(lowImpactEdge, 0.1)).toBe(false);
    });
  });
});

