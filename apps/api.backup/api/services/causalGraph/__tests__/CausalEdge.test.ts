import { describe, expect, it } from '@jest/globals';
import {
  createCausalEdge,
  isCausalEdge,
  isAmplificationEdge,
  isMitigationEdge,
  isContradictionEdge,
  isRequirementEdge,
  isPrecedenceEdge,
  hasHighConfidence,
  hasLowConfidence,
  type CausalEdge,
} from '../models/CausalEdge.js';

describe('CausalEdge', () => {
  const baseEdge: CausalEdge = {
    id: 'edge-1',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    edgeType: 'CAUSES',
    confidenceScore: 0.8,
    createdAt: new Date('2025-01-01'),
  };

  describe('createCausalEdge', () => {
    it('should create a valid causal edge', () => {
      const edge = createCausalEdge({
        id: 'edge-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        edgeType: 'CAUSES',
        confidenceScore: 0.8,
      });

      expect(edge.id).toBe('edge-1');
      expect(edge.edgeType).toBe('CAUSES');
      expect(edge.confidenceScore).toBe(0.8);
      expect(edge.createdAt).toBeInstanceOf(Date);
    });

    it('should reject invalid edge type', () => {
      expect(() =>
        createCausalEdge({
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'INVALID_TYPE' as any,
          confidenceScore: 0.8,
        })
      ).toThrow();
    });

    it('should reject confidence score out of range', () => {
      expect(() =>
        createCausalEdge({
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'CAUSES',
          confidenceScore: 1.5, // > 1
        })
      ).toThrow();

      expect(() =>
        createCausalEdge({
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'CAUSES',
          confidenceScore: -0.1, // < 0
        })
      ).toThrow();
    });
  });

  describe('edge type predicates', () => {
    it('should identify causal edges', () => {
      const edge = createCausalEdge({
        ...baseEdge,
        edgeType: 'CAUSES',
      });
      expect(isCausalEdge(edge)).toBe(true);
      expect(isAmplificationEdge(edge)).toBe(false);
    });

    it('should identify amplification edges', () => {
      const edge = createCausalEdge({
        ...baseEdge,
        edgeType: 'AMPLIFIES',
      });
      expect(isAmplificationEdge(edge)).toBe(true);
    });

    it('should identify mitigation edges', () => {
      const edge = createCausalEdge({
        ...baseEdge,
        edgeType: 'MITIGATES',
      });
      expect(isMitigationEdge(edge)).toBe(true);
    });

    it('should identify contradiction edges', () => {
      const edge = createCausalEdge({
        ...baseEdge,
        edgeType: 'CONTRADICTS',
      });
      expect(isContradictionEdge(edge)).toBe(true);
    });

    it('should identify requirement edges', () => {
      const edge = createCausalEdge({
        ...baseEdge,
        edgeType: 'REQUIRES',
      });
      expect(isRequirementEdge(edge)).toBe(true);
    });

    it('should identify precedence edges', () => {
      const edge = createCausalEdge({
        ...baseEdge,
        edgeType: 'PRECEDES',
      });
      expect(isPrecedenceEdge(edge)).toBe(true);
    });
  });

  describe('confidence predicates', () => {
    it('should identify high confidence edges', () => {
      const edge = createCausalEdge({
        ...baseEdge,
        confidenceScore: 0.85,
      });
      expect(hasHighConfidence(edge, 0.7)).toBe(true);
      expect(hasHighConfidence(edge, 0.9)).toBe(false);
    });

    it('should identify low confidence edges', () => {
      const edge = createCausalEdge({
        ...baseEdge,
        confidenceScore: 0.2,
      });
      expect(hasLowConfidence(edge, 0.3)).toBe(true);
      expect(hasLowConfidence(edge, 0.1)).toBe(false);
    });
  });
});

