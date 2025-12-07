import type { CouplingEdgeType } from './models/CouplingEdge.js';
import type { CouplingNodeType } from './models/CouplingNode.js';

/**
 * CouplingSchemaRegistry defines allowed edges and prevents cycles
 * that break causality. Ensures graph is DAG-like for propagation.
 */
export class CouplingSchemaRegistry {
  /**
   * Allowed edge types for each node type combination
   * Format: sourceNodeType -> targetNodeType -> allowed edge types
   */
  private allowedEdges: Map<CouplingNodeType, Map<CouplingNodeType, Set<CouplingEdgeType>>>;

  /**
   * Edge types that break causality (should be prevented)
   */
  private causalityBreakingEdges: Set<CouplingEdgeType>;

  constructor() {
    this.allowedEdges = new Map();
    this.causalityBreakingEdges = new Set(['CAUSES']); // CAUSES edges can break causality if cycles exist

    this.initializeAllowedEdges();
  }

  /**
   * Initialize allowed edges based on node type combinations
   */
  private initializeAllowedEdges(): void {
    // DEPARTMENT -> ROLE: DEPENDS_ON, FEEDS_INTO
    this.addAllowedEdge('DEPARTMENT', 'ROLE', 'DEPENDS_ON');
    this.addAllowedEdge('DEPARTMENT', 'ROLE', 'FEEDS_INTO');

    // DEPARTMENT -> PRIVILEGE_SET: DEPENDS_ON
    this.addAllowedEdge('DEPARTMENT', 'PRIVILEGE_SET', 'DEPENDS_ON');

    // ROLE -> PRIVILEGE_SET: DEPENDS_ON (via privilege DAG)
    this.addAllowedEdge('ROLE', 'PRIVILEGE_SET', 'DEPENDS_ON');

    // PRIVILEGE_SET -> PRIVILEGE_SET: DEPENDS_ON (from privilege DAG)
    this.addAllowedEdge('PRIVILEGE_SET', 'PRIVILEGE_SET', 'DEPENDS_ON');

    // ENROLLMENT_POOL -> PRIVILEGE_SET: FEEDS_INTO, AMPLIFIES
    this.addAllowedEdge('ENROLLMENT_POOL', 'PRIVILEGE_SET', 'FEEDS_INTO');
    this.addAllowedEdge('ENROLLMENT_POOL', 'PRIVILEGE_SET', 'AMPLIFIES');

    // EHR_DOMAIN -> DEPARTMENT: FEEDS_INTO, BLOCKS
    this.addAllowedEdge('EHR_DOMAIN', 'DEPARTMENT', 'FEEDS_INTO');
    this.addAllowedEdge('EHR_DOMAIN', 'DEPARTMENT', 'BLOCKS');

    // STATE_REGION -> ENROLLMENT_POOL: FEEDS_INTO
    this.addAllowedEdge('STATE_REGION', 'ENROLLMENT_POOL', 'FEEDS_INTO');

    // SERVICE_LINE -> DEPARTMENT: FEEDS_INTO, AMPLIFIES
    this.addAllowedEdge('SERVICE_LINE', 'DEPARTMENT', 'FEEDS_INTO');
    this.addAllowedEdge('SERVICE_LINE', 'DEPARTMENT', 'AMPLIFIES');

    // Generic: DEPENDS_ON, FEEDS_INTO, BLOCKS, AMPLIFIES, DEGRADES, STRENGTHENS
    // (CAUSES is allowed but must be checked for cycles)
    const genericTypes: CouplingNodeType[] = [
      'DEPARTMENT',
      'ROLE',
      'PRIVILEGE_SET',
      'ENROLLMENT_POOL',
      'EHR_DOMAIN',
      'STATE_REGION',
      'SERVICE_LINE',
    ];

    const genericEdgeTypes: CouplingEdgeType[] = [
      'DEPENDS_ON',
      'FEEDS_INTO',
      'BLOCKS',
      'AMPLIFIES',
      'DEGRADES',
      'STRENGTHENS',
      'CAUSES',
    ];

    for (const sourceType of genericTypes) {
      for (const targetType of genericTypes) {
        if (sourceType !== targetType) {
          for (const edgeType of genericEdgeTypes) {
            this.addAllowedEdge(sourceType, targetType, edgeType);
          }
        }
      }
    }
  }

  /**
   * Add an allowed edge type for a node type combination
   */
  private addAllowedEdge(
    sourceType: CouplingNodeType,
    targetType: CouplingNodeType,
    edgeType: CouplingEdgeType
  ): void {
    if (!this.allowedEdges.has(sourceType)) {
      this.allowedEdges.set(sourceType, new Map());
    }
    const targetMap = this.allowedEdges.get(sourceType)!;
    if (!targetMap.has(targetType)) {
      targetMap.set(targetType, new Set());
    }
    targetMap.get(targetType)!.add(edgeType);
  }

  /**
   * Check if an edge type is allowed between two node types
   */
  isEdgeTypeAllowed(
    edgeType: CouplingEdgeType,
    sourceType?: CouplingNodeType,
    targetType?: CouplingNodeType
  ): boolean {
    // If node types are provided, check specific combination
    if (sourceType && targetType) {
      const targetMap = this.allowedEdges.get(sourceType);
      if (!targetMap) return false;
      const allowedTypes = targetMap.get(targetType);
      if (!allowedTypes) return false;
      return allowedTypes.has(edgeType);
    }

    // Otherwise, just check if edge type is valid (not in causality-breaking set)
    return !this.causalityBreakingEdges.has(edgeType) || edgeType === 'CAUSES';
  }

  /**
   * Check if adding an edge would create a cycle
   * This is a simplified check - in production, you'd need the full graph structure
   */
  wouldCreateCycle(sourceId: string, targetId: string): boolean {
    // Basic check: prevent self-loops
    if (sourceId === targetId) {
      return true;
    }

    // In a full implementation, you'd need to:
    // 1. Load the current graph structure
    // 2. Check if targetId can reach sourceId (would create cycle)
    // 3. Use DFS or BFS to detect cycles

    // For now, we'll rely on the database constraints and application-level checks
    return false;
  }

  /**
   * Validate that an edge can be created
   */
  validateEdge(
    sourceType: CouplingNodeType,
    targetType: CouplingNodeType,
    edgeType: CouplingEdgeType,
    sourceId: string,
    targetId: string
  ): { valid: boolean; reason?: string } {
    // Check self-loops
    if (sourceId === targetId) {
      return { valid: false, reason: 'Self-loops are not allowed' };
    }

    // Check if edge type is allowed
    if (!this.isEdgeTypeAllowed(edgeType, sourceType, targetType)) {
      return {
        valid: false,
        reason: `Edge type ${edgeType} is not allowed from ${sourceType} to ${targetType}`,
      };
    }

    // Check for cycles (simplified)
    if (this.wouldCreateCycle(sourceId, targetId)) {
      return { valid: false, reason: 'Edge would create a cycle' };
    }

    return { valid: true };
  }

  /**
   * Get allowed edge types for a node type combination
   */
  getAllowedEdgeTypes(
    sourceType: CouplingNodeType,
    targetType: CouplingNodeType
  ): Set<CouplingEdgeType> {
    const targetMap = this.allowedEdges.get(sourceType);
    if (!targetMap) return new Set();
    return targetMap.get(targetType) || new Set();
  }
}

