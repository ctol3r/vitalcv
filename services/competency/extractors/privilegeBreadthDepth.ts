/**
 * B205A-CCI-004: PrivilegeBreadthDepthCalculator
 *
 * Calculates privilege depth (sub-privilege chain) and breadth (distinct domains).
 */

import type { PrivilegeCategory } from '@prisma/client';

export interface PrivilegeNode {
  privilegeCode: string;
  category: PrivilegeCategory;
  dependencies?: Array<{
    privilegeCode: string;
    dependencyType: 'REQUIRES' | 'ENHANCES' | 'CONFLICTS_WITH' | 'MUTUALLY_EXCLUSIVE';
  }>;
}

export interface PrivilegeBreadthDepthResult {
  depth: number; // 0-1 normalized (sub-privilege chain depth)
  breadth: number; // 0-1 normalized (distinct privilege domains)
  maxChainDepth: number; // Raw maximum dependency chain depth
  distinctCategories: number; // Raw count of distinct categories
  categoryDistribution: Record<PrivilegeCategory, number>; // Count per category
}

/**
 * Calculate privilege breadth and depth
 */
export class PrivilegeBreadthDepthCalculator {
  /**
   * Calculate depth by traversing dependency chains
   */
  private calculateDepth(
    privilegeCode: string,
    privileges: Map<string, PrivilegeNode>,
    visited: Set<string> = new Set(),
    currentDepth: number = 0
  ): number {
    if (visited.has(privilegeCode)) {
      // Circular dependency detected, return current depth
      return currentDepth;
    }

    visited.add(privilegeCode);
    const privilege = privileges.get(privilegeCode);

    if (!privilege || !privilege.dependencies || privilege.dependencies.length === 0) {
      return currentDepth;
    }

    let maxDepth = currentDepth;

    // Traverse REQUIRES dependencies (these form the depth chain)
    for (const dep of privilege.dependencies) {
      if (dep.dependencyType === 'REQUIRES') {
        const depDepth = this.calculateDepth(
          dep.privilegeCode,
          privileges,
          new Set(visited), // New set for each branch
          currentDepth + 1
        );
        maxDepth = Math.max(maxDepth, depDepth);
      }
    }

    return maxDepth;
  }

  /**
   * Calculate breadth by counting distinct categories
   */
  private calculateBreadth(privileges: PrivilegeNode[]): {
    distinctCategories: number;
    categoryDistribution: Record<PrivilegeCategory, number>;
  } {
    const categorySet = new Set<PrivilegeCategory>();
    const distribution: Record<PrivilegeCategory, number> = {
      surgical: 0,
      procedural: 0,
      diagnostic: 0,
      admin: 0,
    };

    for (const privilege of privileges) {
      categorySet.add(privilege.category);
      distribution[privilege.category] = (distribution[privilege.category] || 0) + 1;
    }

    return {
      distinctCategories: categorySet.size,
      categoryDistribution: distribution,
    };
  }

  /**
   * Calculate breadth and depth for a set of privileges
   */
  calculate(privileges: PrivilegeNode[]): PrivilegeBreadthDepthResult {
    if (privileges.length === 0) {
      return {
        depth: 0,
        breadth: 0,
        maxChainDepth: 0,
        distinctCategories: 0,
        categoryDistribution: {
          surgical: 0,
          procedural: 0,
          diagnostic: 0,
          admin: 0,
        },
      };
    }

    // Build privilege map for efficient lookup
    const privilegeMap = new Map<string, PrivilegeNode>();
    for (const privilege of privileges) {
      privilegeMap.set(privilege.privilegeCode, privilege);
    }

    // Calculate depth for each privilege and find maximum
    let maxChainDepth = 0;
    for (const privilege of privileges) {
      const depth = this.calculateDepth(privilege.privilegeCode, privilegeMap);
      maxChainDepth = Math.max(maxChainDepth, depth);
    }

    // Calculate breadth
    const { distinctCategories, categoryDistribution } = this.calculateBreadth(privileges);

    // Normalize depth (0-1)
    // Typical max depth might be 5-7 levels, normalize to 10 for safety
    const maxExpectedDepth = 10;
    const normalizedDepth = Math.min(1, maxChainDepth / maxExpectedDepth);

    // Normalize breadth (0-1)
    // There are 4 categories, so max breadth is 4
    const maxCategories = 4;
    const normalizedBreadth = Math.min(1, distinctCategories / maxCategories);

    return {
      depth: normalizedDepth,
      breadth: normalizedBreadth,
      maxChainDepth,
      distinctCategories,
      categoryDistribution,
    };
  }

  /**
   * Calculate only depth
   */
  calculateDepthOnly(privileges: PrivilegeNode[]): number {
    return this.calculate(privileges).depth;
  }

  /**
   * Calculate only breadth
   */
  calculateBreadthOnly(privileges: PrivilegeNode[]): number {
    return this.calculate(privileges).breadth;
  }
}

/**
 * Default calculator instance
 */
export const privilegeBreadthDepthCalculator = new PrivilegeBreadthDepthCalculator();

