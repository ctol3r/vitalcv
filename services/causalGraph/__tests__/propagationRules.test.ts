import { describe, expect, it } from '@jest/globals';
import {
  findApplicableRules,
  getRulesForSourceType,
  getRulesForTargetType,
  getRulesForEdgeType,
  PROPAGATION_RULES,
} from '../propagationRules.js';
import { createCausalNode, type CausalNode } from '../models/CausalNode.js';

describe('PropagationRulesEngine', () => {
  const createTestNode = (
    nodeType: CausalNode['nodeType'],
    metadata?: Record<string, unknown>
  ): CausalNode => {
    return createCausalNode({
      id: `node-${nodeType}`,
      nodeType,
      sourceEventId: 'event-1',
      sourceEventType: 'TestEvent',
      clinicianId: 'clinician-1',
      timestamp: new Date('2025-01-01'),
      metadata,
    });
  };

  describe('findApplicableRules', () => {
    it('should find rules matching node types', () => {
      const source = createTestNode('DRIFT_EVENT', { category: 'licensure' });
      const target = createTestNode('PRIVILEGE_RESTRICTION');

      const rules = findApplicableRules(source, target);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].sourceNodeType).toBe('DRIFT_EVENT');
      expect(rules[0].targetNodeType).toBe('PRIVILEGE_RESTRICTION');
    });

    it('should apply condition filters', () => {
      const source = createTestNode('DRIFT_EVENT', { category: 'licensure' });
      const target = createTestNode('PRIVILEGE_RESTRICTION');

      const rules = findApplicableRules(source, target);
      const licensureRule = rules.find(
        (r) => r.description?.includes('License or board certification')
      );
      expect(licensureRule).toBeDefined();
    });

    it('should return empty array for non-matching node types', () => {
      const source = createTestNode('FORECAST_RISK');
      const target = createTestNode('DRIFT_EVENT');

      const rules = findApplicableRules(source, target);
      // No direct rule from FORECAST_RISK to DRIFT_EVENT
      expect(rules.length).toBe(0);
    });
  });

  describe('getRulesForSourceType', () => {
    it('should return all rules for a source type', () => {
      const rules = getRulesForSourceType('DRIFT_EVENT');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.sourceNodeType === 'DRIFT_EVENT')).toBe(true);
    });
  });

  describe('getRulesForTargetType', () => {
    it('should return all rules for a target type', () => {
      const rules = getRulesForTargetType('PRIVILEGE_RESTRICTION');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.targetNodeType === 'PRIVILEGE_RESTRICTION')).toBe(true);
    });
  });

  describe('getRulesForEdgeType', () => {
    it('should return all rules for an edge type', () => {
      const rules = getRulesForEdgeType('CAUSES');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.edgeType === 'CAUSES')).toBe(true);
    });
  });

  describe('rule definitions', () => {
    it('should have valid rule structure', () => {
      for (const rule of PROPAGATION_RULES) {
        expect(rule.sourceNodeType).toBeDefined();
        expect(rule.targetNodeType).toBeDefined();
        expect(rule.edgeType).toBeDefined();
        if (rule.baseConfidence !== undefined) {
          expect(rule.baseConfidence).toBeGreaterThanOrEqual(0);
          expect(rule.baseConfidence).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});

