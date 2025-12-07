/**
 * Tests for CaseComplexityCalculator
 */

import { describe, it, expect } from '@jest/globals';
import { caseComplexityCalculator, type ProcedureCase } from '../caseComplexity.js';

describe('CaseComplexityCalculator', () => {
  describe('calculate', () => {
    it('should calculate complexity for surgical procedures', () => {
      const procedures: ProcedureCase[] = [
        {
          privilegeCode: 'SURG-001',
          category: 'surgical',
          caseCount: 50,
          complicationCount: 2,
        },
      ];

      const result = caseComplexityCalculator.calculate(procedures);

      expect(result.complexityIndex).toBeGreaterThan(0);
      expect(result.totalCases).toBe(50);
      expect(result.totalComplications).toBe(2);
      expect(result.breakdown.byCategory.surgical.cases).toBe(50);
    });

    it('should weight surgical procedures higher than diagnostic', () => {
      const surgical: ProcedureCase[] = [
        {
          privilegeCode: 'SURG-001',
          category: 'surgical',
          caseCount: 10,
        },
      ];

      const diagnostic: ProcedureCase[] = [
        {
          privilegeCode: 'DIAG-001',
          category: 'diagnostic',
          caseCount: 10,
        },
      ];

      const surgicalResult = caseComplexityCalculator.calculate(surgical);
      const diagnosticResult = caseComplexityCalculator.calculate(diagnostic);

      expect(surgicalResult.complexityIndex).toBeGreaterThan(diagnosticResult.complexityIndex);
    });

    it('should integrate safety signals', () => {
      const procedures: ProcedureCase[] = [
        {
          privilegeCode: 'SURG-001',
          category: 'surgical',
          caseCount: 50,
          safetySignals: [
            { severity: 'CRITICAL', type: 'SAFETY_ALERT' },
            { severity: 'HIGH', type: 'QUALITY_ISSUE' },
          ],
        },
      ];

      const result = caseComplexityCalculator.calculate(procedures);

      expect(result.complexityIndex).toBeGreaterThan(0);
      expect(result.safetySignalCount).toBeGreaterThan(0);
    });

    it('should handle empty procedures', () => {
      const result = caseComplexityCalculator.calculate([]);

      expect(result.complexityIndex).toBe(0);
      expect(result.totalCases).toBe(0);
      expect(result.totalComplications).toBe(0);
    });

    it('should adjust for poor outcomes', () => {
      const procedures: ProcedureCase[] = [
        {
          privilegeCode: 'SURG-001',
          category: 'surgical',
          caseCount: 50,
          outcomes: {
            successRate: 0.5, // Poor success rate
            adverseEvents: 5,
          },
        },
      ];

      const result = caseComplexityCalculator.calculate(procedures);
      expect(result.complexityIndex).toBeGreaterThan(0);
    });
  });

  describe('calculateSingle', () => {
    it('should calculate complexity for a single procedure', () => {
      const procedure: ProcedureCase = {
        privilegeCode: 'PROC-001',
        category: 'procedural',
        caseCount: 25,
      };

      const complexity = caseComplexityCalculator.calculateSingle(procedure);
      expect(complexity).toBeGreaterThanOrEqual(0);
      expect(complexity).toBeLessThanOrEqual(1);
    });
  });
});

