import { PrismaClient } from '@prisma/client';
import { createCouplingNode, type CouplingNode, type CouplingNodeType } from './models/CouplingNode.js';
import { createCouplingEdge, type CouplingEdge } from './models/CouplingEdge.js';
import { CouplingSchemaRegistry } from './schemaRegistry.js';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface OrgStructure {
  departments: Array<{ id: string; name: string; orgId?: string }>;
  roles: Array<{ id: string; name: string; departmentId?: string; orgId?: string }>;
  privilegeSets: Array<{ id: string; name: string; departmentId?: string; orgId?: string }>;
}

export interface PrivilegeDAG {
  nodes: Array<{ id: string; privilegeCode: string; name: string }>;
  edges: Array<{ parentId: string; childId: string; dependencyType: string }>;
}

export interface WorkflowAssumptions {
  serviceDependencies: Array<{ source: string; target: string; type: string }>;
  staffingRelationships: Array<{ source: string; target: string; type: string }>;
}

export interface GraphBuildResult {
  nodes: CouplingNode[];
  edges: CouplingEdge[];
  nodeCount: number;
  edgeCount: number;
}

/**
 * CouplingGraphBuilder builds a system graph from:
 * - Organization structure (departments, roles, privilege sets)
 * - Privilege DAG (dependency relationships)
 * - Workflow assumptions (service dependencies, staffing relationships)
 * - Enrollment pools
 * - EHR domains
 * - State regions
 * - Service lines
 */
export class CouplingGraphBuilder {
  private schemaRegistry: CouplingSchemaRegistry;

  constructor() {
    this.schemaRegistry = new CouplingSchemaRegistry();
  }

  /**
   * Build a coupling graph for an organization
   */
  async buildGraphForOrg(
    orgId: string,
    orgStructure?: OrgStructure,
    privilegeDAG?: PrivilegeDAG,
    workflowAssumptions?: WorkflowAssumptions
  ): Promise<GraphBuildResult> {
    const nodes: CouplingNode[] = [];
    const edges: CouplingEdge[] = [];
    const nodeMap = new Map<string, CouplingNode>();

    // Build nodes from organization structure
    if (orgStructure) {
      await this.buildNodesFromOrgStructure(orgStructure, orgId, nodes, nodeMap);
    } else {
      await this.buildNodesFromDatabase(orgId, nodes, nodeMap);
    }

    // Build nodes from privilege DAG
    if (privilegeDAG) {
      await this.buildNodesFromPrivilegeDAG(privilegeDAG, orgId, nodes, nodeMap);
    }

    // Build edges from organization structure
    if (orgStructure) {
      await this.buildEdgesFromOrgStructure(orgStructure, nodes, nodeMap, edges);
    }

    // Build edges from privilege DAG
    if (privilegeDAG) {
      await this.buildEdgesFromPrivilegeDAG(privilegeDAG, nodes, nodeMap, edges);
    }

    // Build edges from workflow assumptions
    if (workflowAssumptions) {
      await this.buildEdgesFromWorkflowAssumptions(workflowAssumptions, nodes, nodeMap, edges);
    }

    // Build edges from database relationships
    await this.buildEdgesFromDatabase(orgId, nodes, nodeMap, edges);

    return {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  }

  /**
   * Build nodes from organization structure
   */
  private async buildNodesFromOrgStructure(
    orgStructure: OrgStructure,
    orgId: string,
    nodes: CouplingNode[],
    nodeMap: Map<string, CouplingNode>
  ): Promise<void> {
    // Build department nodes
    for (const dept of orgStructure.departments) {
      const node = createCouplingNode({
        id: dept.id,
        nodeType: 'DEPARTMENT',
        name: dept.name,
        orgId: dept.orgId || orgId,
        metadata: { source: 'orgStructure' },
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
    }

    // Build role nodes
    for (const role of orgStructure.roles) {
      const node = createCouplingNode({
        id: role.id,
        nodeType: 'ROLE',
        name: role.name,
        orgId: role.orgId || orgId,
        metadata: { source: 'orgStructure', departmentId: role.departmentId },
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
    }

    // Build privilege set nodes
    for (const privSet of orgStructure.privilegeSets) {
      const node = createCouplingNode({
        id: privSet.id,
        nodeType: 'PRIVILEGE_SET',
        name: privSet.name,
        orgId: privSet.orgId || orgId,
        metadata: { source: 'orgStructure', departmentId: privSet.departmentId },
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
    }
  }

  /**
   * Build nodes from database
   */
  private async buildNodesFromDatabase(
    orgId: string,
    nodes: CouplingNode[],
    nodeMap: Map<string, CouplingNode>
  ): Promise<void> {
    try {
      const dbNodes = await prisma.couplingNode.findMany({
        where: { orgId },
      });

      for (const dbNode of dbNodes) {
        const node = createCouplingNode({
          id: dbNode.id,
          nodeType: dbNode.nodeType as CouplingNodeType,
          name: dbNode.name,
          orgId: dbNode.orgId || undefined,
          metadata: dbNode.metadata as Record<string, unknown> | undefined,
          createdAt: dbNode.createdAt,
          updatedAt: dbNode.updatedAt,
        });
        nodes.push(node);
        nodeMap.set(node.id, node);
      }
    } catch (error) {
      console.warn('CouplingNode model not available:', error);
    }
  }

  /**
   * Build nodes from privilege DAG
   */
  private async buildNodesFromPrivilegeDAG(
    privilegeDAG: PrivilegeDAG,
    orgId: string,
    nodes: CouplingNode[],
    nodeMap: Map<string, CouplingNode>
  ): Promise<void> {
    for (const privNode of privilegeDAG.nodes) {
      if (!nodeMap.has(privNode.id)) {
        const node = createCouplingNode({
          id: privNode.id,
          nodeType: 'PRIVILEGE_SET',
          name: privNode.name,
          orgId,
          metadata: { source: 'privilegeDAG', privilegeCode: privNode.privilegeCode },
        });
        nodes.push(node);
        nodeMap.set(node.id, node);
      }
    }
  }

  /**
   * Build edges from organization structure
   */
  private async buildEdgesFromOrgStructure(
    orgStructure: OrgStructure,
    nodes: CouplingNode[],
    nodeMap: Map<string, CouplingNode>,
    edges: CouplingEdge[]
  ): Promise<void> {
    // Roles depend on departments
    for (const role of orgStructure.roles) {
      if (role.departmentId && nodeMap.has(role.id) && nodeMap.has(role.departmentId)) {
        const edge = this.createEdgeIfAllowed(
          role.departmentId,
          role.id,
          'DEPENDS_ON',
          0.7,
          1.0,
          { source: 'orgStructure', relationship: 'role_department' }
        );
        if (edge) edges.push(edge);
      }
    }

    // Privilege sets depend on roles
    for (const privSet of orgStructure.privilegeSets) {
      if (privSet.departmentId && nodeMap.has(privSet.id) && nodeMap.has(privSet.departmentId)) {
        const edge = this.createEdgeIfAllowed(
          privSet.departmentId,
          privSet.id,
          'DEPENDS_ON',
          0.8,
          1.0,
          { source: 'orgStructure', relationship: 'privilege_department' }
        );
        if (edge) edges.push(edge);
      }
    }
  }

  /**
   * Build edges from privilege DAG
   */
  private async buildEdgesFromPrivilegeDAG(
    privilegeDAG: PrivilegeDAG,
    nodes: CouplingNode[],
    nodeMap: Map<string, CouplingNode>,
    edges: CouplingEdge[]
  ): Promise<void> {
    for (const dagEdge of privilegeDAG.edges) {
      if (nodeMap.has(dagEdge.parentId) && nodeMap.has(dagEdge.childId)) {
        // Map dependency types to coupling edge types
        // Privilege dependencies map to DEPENDS_ON
        const edgeType: 'DEPENDS_ON' = 'DEPENDS_ON';

        const edge = this.createEdgeIfAllowed(
          dagEdge.parentId,
          dagEdge.childId,
          edgeType,
          0.9, // High impact for privilege dependencies
          1.0,
          { source: 'privilegeDAG', dependencyType: dagEdge.dependencyType }
        );
        if (edge) edges.push(edge);
      }
    }
  }

  /**
   * Build edges from workflow assumptions
   */
  private async buildEdgesFromWorkflowAssumptions(
    workflowAssumptions: WorkflowAssumptions,
    nodes: CouplingNode[],
    nodeMap: Map<string, CouplingNode>,
    edges: CouplingEdge[]
  ): Promise<void> {
    // Service dependencies
    for (const dep of workflowAssumptions.serviceDependencies) {
      if (nodeMap.has(dep.source) && nodeMap.has(dep.target)) {
        const edgeType = this.mapWorkflowTypeToEdgeType(dep.type);
        const edge = this.createEdgeIfAllowed(
          dep.source,
          dep.target,
          edgeType,
          0.6,
          1.0,
          { source: 'workflowAssumptions', type: 'serviceDependency' }
        );
        if (edge) edges.push(edge);
      }
    }

    // Staffing relationships
    for (const rel of workflowAssumptions.staffingRelationships) {
      if (nodeMap.has(rel.source) && nodeMap.has(rel.target)) {
        const edgeType = this.mapWorkflowTypeToEdgeType(rel.type);
        const edge = this.createEdgeIfAllowed(
          rel.source,
          rel.target,
          edgeType,
          0.5,
          1.0,
          { source: 'workflowAssumptions', type: 'staffingRelationship' }
        );
        if (edge) edges.push(edge);
      }
    }
  }

  /**
   * Build edges from database relationships
   */
  private async buildEdgesFromDatabase(
    orgId: string,
    nodes: CouplingNode[],
    nodeMap: Map<string, CouplingNode>,
    edges: CouplingEdge[]
  ): Promise<void> {
    try {
      const dbEdges = await prisma.couplingEdge.findMany({
        where: {
          OR: [
            { sourceNode: { orgId } },
            { targetNode: { orgId } },
          ],
        },
        include: {
          sourceNode: true,
          targetNode: true,
        },
      });

      for (const dbEdge of dbEdges) {
        if (nodeMap.has(dbEdge.sourceNodeId) && nodeMap.has(dbEdge.targetNodeId)) {
          const edge = createCouplingEdge({
            id: dbEdge.id,
            sourceNodeId: dbEdge.sourceNodeId,
            targetNodeId: dbEdge.targetNodeId,
            edgeType: dbEdge.edgeType as any,
            impactWeight: dbEdge.impactWeight,
            delayFactor: dbEdge.delayFactor,
            metadata: dbEdge.metadata as Record<string, unknown> | undefined,
            createdAt: dbEdge.createdAt,
            updatedAt: dbEdge.updatedAt,
          });
          edges.push(edge);
        }
      }
    } catch (error) {
      console.warn('CouplingEdge model not available:', error);
    }
  }

  /**
   * Create an edge if it's allowed by the schema registry
   */
  private createEdgeIfAllowed(
    sourceId: string,
    targetId: string,
    edgeType: string,
    impactWeight: number,
    delayFactor: number,
    metadata?: Record<string, unknown>
  ): CouplingEdge | null {
    // Check if edge would create a cycle
    if (this.schemaRegistry.wouldCreateCycle(sourceId, targetId)) {
      return null;
    }

    // Check if edge type is allowed
    if (!this.schemaRegistry.isEdgeTypeAllowed(edgeType as any)) {
      return null;
    }

    return createCouplingEdge({
      id: randomUUID(),
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      edgeType: edgeType as any,
      impactWeight,
      delayFactor,
      metadata,
    });
  }

  /**
   * Map workflow type to edge type
   */
  private mapWorkflowTypeToEdgeType(type: string): 'DEPENDS_ON' | 'FEEDS_INTO' | 'BLOCKS' {
    const upper = type.toUpperCase();
    if (upper === 'DEPENDS' || upper === 'DEPENDS_ON') return 'DEPENDS_ON';
    if (upper === 'FEEDS' || upper === 'FEEDS_INTO') return 'FEEDS_INTO';
    if (upper === 'BLOCKS') return 'BLOCKS';
    return 'DEPENDS_ON'; // Default
  }
}

/**
 * Build a coupling graph for an organization
 */
export async function buildCouplingGraph(
  orgId: string,
  orgStructure?: OrgStructure,
  privilegeDAG?: PrivilegeDAG,
  workflowAssumptions?: WorkflowAssumptions
): Promise<GraphBuildResult> {
  const builder = new CouplingGraphBuilder();
  return builder.buildGraphForOrg(orgId, orgStructure, privilegeDAG, workflowAssumptions);
}

