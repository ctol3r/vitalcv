import { describe, expect, it } from '@jest/globals';
import {
  createCausalNode,
  isDriftEventNode,
  isQualitySignalNode,
  isSafetySignalNode,
  isRiskSpikeNode,
  type CausalNode,
} from '../models/CausalNode.js';

describe('CausalNode', () => {
  const baseNode: CausalNode = {
    id: 'node-1',
    nodeType: 'DRIFT_EVENT',
    sourceEventId: 'event-1',
    sourceEventType: 'DriftEvent',
    clinicianId: 'clinician-1',
    timestamp: new Date('2025-01-01'),
    severity: 'MED',
  };

  describe('createCausalNode', () => {
    it('should create a valid causal node', () => {
      const node = createCausalNode({
        id: 'node-1',
        nodeType: 'DRIFT_EVENT',
        sourceEventId: 'event-1',
        sourceEventType: 'DriftEvent',
        clinicianId: 'clinician-1',
      });

      expect(node.id).toBe('node-1');
      expect(node.nodeType).toBe('DRIFT_EVENT');
      expect(node.sourceEventId).toBe('event-1');
      expect(node.clinicianId).toBe('clinician-1');
      expect(node.timestamp).toBeInstanceOf(Date);
    });

    it('should reject invalid node type', () => {
      expect(() =>
        createCausalNode({
          id: 'node-1',
          nodeType: 'INVALID_TYPE' as any,
          sourceEventId: 'event-1',
          sourceEventType: 'DriftEvent',
          clinicianId: 'clinician-1',
        })
      ).toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() =>
        createCausalNode({
          id: '',
          nodeType: 'DRIFT_EVENT',
          sourceEventId: 'event-1',
          sourceEventType: 'DriftEvent',
          clinicianId: 'clinician-1',
        })
      ).toThrow();
    });
  });

  describe('node type predicates', () => {
    it('should identify drift event nodes', () => {
      const node = createCausalNode({
        ...baseNode,
        nodeType: 'DRIFT_EVENT',
      });
      expect(isDriftEventNode(node)).toBe(true);
      expect(isQualitySignalNode(node)).toBe(false);
    });

    it('should identify quality signal nodes', () => {
      const node = createCausalNode({
        ...baseNode,
        nodeType: 'QUALITY_SIGNAL',
      });
      expect(isQualitySignalNode(node)).toBe(true);
      expect(isDriftEventNode(node)).toBe(false);
    });

    it('should identify safety signal nodes', () => {
      const node = createCausalNode({
        ...baseNode,
        nodeType: 'SAFETY_SIGNAL',
      });
      expect(isSafetySignalNode(node)).toBe(true);
    });

    it('should identify risk spike nodes', () => {
      const node = createCausalNode({
        ...baseNode,
        nodeType: 'RISK_SPIKE',
      });
      expect(isRiskSpikeNode(node)).toBe(true);
    });
  });
});

