/**
 * Tests for PrivilegeBreadthDepthCalculator
 */

import { describe, it, expect } from '@jest/globals';
import { privilegeBreadthDepthCalculator, type PrivilegeNode } from '../privilegeBreadthDepth.js';

describe('PrivilegeBreadthDepthCalculator', () => {
  describe('calculate', () => {
    it('should calculate breadth for multiple categories', () => {
      const privileges: PrivilegeNode[] = [
        {
          privilegeCode: 'PRIV-001',
          category: 'surgical',
        },
        {
          privilegeCode: 'PRIV-002',
          category: 'diagnostic',
        },
        {
          privilegeCode: 'PRIV-003',
          category: 'procedural',
        },
      ];

      const result = privilegeBreadthDepthCalculator.calculate(privileges);

      expect(result.breadth).toBeGreaterThan(0);
      expect(result.distinctCategories).toBe(3);
      expect(result.categoryDistribution.surgical).toBe(1);
      expect(result.categoryDistribution.diagnostic).toBe(1);
      expect(result.categoryDistribution.procedural).toBe(1);
    });

    it('should calculate depth for dependency chains', () => {
      const privileges: PrivilegeNode[] = [
        {
          privilegeCode: 'PRIV-001',
          category: 'surgical',
          dependencies: [
            {
              privilegeCode: 'PRIV-002',
              dependencyType: 'REQUIRES',
            },
          ],
        },
        {
          privilegeCode: 'PRIV-002',
          category: 'procedural',
          dependencies: [
            {
              privilegeCode: 'PRIV-003',
              dependencyType: 'REQUIRES',
            },
          ],
        },
        {
          privilegeCode: 'PRIV-003',
          category: 'diagnostic',
          dependencies: [], // Leaf node
        },
      ];

      const result = privilegeBreadthDepthCalculator.calculate(privileges);

      expect(result.depth).toBeGreaterThan(0);
      expect(result.maxChainDepth).toBeGreaterThanOrEqual(2);
    });

    it('should handle circular dependencies', () => {
      const privileges: PrivilegeNode[] = [
        {
          privilegeCode: 'PRIV-001',
          category: 'surgical',
          dependencies: [
            {
              privilegeCode: 'PRIV-002',
              dependencyType: 'REQUIRES',
            },
          ],
        },
        {
          privilegeCode: 'PRIV-002',
          category: 'procedural',
          dependencies: [
            {
              privilegeCode: 'PRIV-001',
              dependencyType: 'REQUIRES',
            },
          ],
        },
      ];

      const result = privilegeBreadthDepthCalculator.calculate(privileges);

      // Should not throw and should return a valid depth
      expect(result.depth).toBeGreaterThanOrEqual(0);
      expect(result.depth).toBeLessThanOrEqual(1);
    });

    it('should handle empty privileges', () => {
      const result = privilegeBreadthDepthCalculator.calculate([]);

      expect(result.depth).toBe(0);
      expect(result.breadth).toBe(0);
      expect(result.maxChainDepth).toBe(0);
      expect(result.distinctCategories).toBe(0);
    });

    it('should ignore non-REQUIRES dependencies for depth', () => {
      const privileges: PrivilegeNode[] = [
        {
          privilegeCode: 'PRIV-001',
          category: 'surgical',
          dependencies: [
            {
              privilegeCode: 'PRIV-002',
              dependencyType: 'ENHANCES', // Not REQUIRES
            },
          ],
        },
        {
          privilegeCode: 'PRIV-002',
          category: 'procedural',
          dependencies: [],
        },
      ];

      const result = privilegeBreadthDepthCalculator.calculate(privileges);

      // ENHANCES doesn't count for depth
      expect(result.maxChainDepth).toBe(0);
    });
  });

  describe('calculateDepthOnly', () => {
    it('should return only depth', () => {
      const privileges: PrivilegeNode[] = [
        {
          privilegeCode: 'PRIV-001',
          category: 'surgical',
          dependencies: [
            {
              privilegeCode: 'PRIV-002',
              dependencyType: 'REQUIRES',
            },
          ],
        },
        {
          privilegeCode: 'PRIV-002',
          category: 'procedural',
          dependencies: [],
        },
      ];

      const depth = privilegeBreadthDepthCalculator.calculateDepthOnly(privileges);
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateBreadthOnly', () => {
    it('should return only breadth', () => {
      const privileges: PrivilegeNode[] = [
        {
          privilegeCode: 'PRIV-001',
          category: 'surgical',
        },
        {
          privilegeCode: 'PRIV-002',
          category: 'diagnostic',
        },
      ];

      const breadth = privilegeBreadthDepthCalculator.calculateBreadthOnly(privileges);
      expect(breadth).toBeGreaterThan(0);
      expect(breadth).toBeLessThanOrEqual(1);
    });
  });
});

