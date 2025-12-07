import { createGraphEdge, GraphEdge, GraphRelationType } from './models/GraphEdge.js';
import { createGraphNode, GraphNode, GraphNodeType } from './models/GraphNode.js';
import { GraphData } from './types.js';

interface EdgeRule {
  sourceType: GraphNodeType;
  relationType: GraphRelationType;
  targetType: GraphNodeType;
}

interface IllegalCycleRule {
  relationType: GraphRelationType;
  nodeTypes?: GraphNodeType[];
  description: string;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
}

export class GraphSchemaRegistry {
  private readonly allowedEdgeMatrix = new Map<GraphNodeType, Map<GraphRelationType, Set<GraphNodeType>>>();
  private readonly requiredNodeTypes = new Set<GraphNodeType>();
  private readonly illegalCycleRules: IllegalCycleRule[] = [];

  static createDefault(): GraphSchemaRegistry {
    const registry = new GraphSchemaRegistry();

    const edgeRules: EdgeRule[] = [
      { sourceType: 'CLINICIAN', relationType: 'HAS_LICENSE', targetType: 'LICENSE' },
      { sourceType: 'CLINICIAN', relationType: 'HAS_LICENSE', targetType: 'DEA' },
      { sourceType: 'CLINICIAN', relationType: 'BELONGS_TO', targetType: 'ORG' },
      { sourceType: 'CLINICIAN', relationType: 'ELIGIBLE_IN', targetType: 'STATE' },
      { sourceType: 'CLINICIAN', relationType: 'ELIGIBLE_IN', targetType: 'COMPACT' },
      { sourceType: 'CLINICIAN', relationType: 'DEPENDS_ON', targetType: 'PAYER' },
      { sourceType: 'CLINICIAN', relationType: 'DEPENDS_ON', targetType: 'PECOS' },
      { sourceType: 'CLINICIAN', relationType: 'DEPENDS_ON', targetType: 'MEDICAID' },

      { sourceType: 'LICENSE', relationType: 'ISSUED_BY', targetType: 'STATE' },
      { sourceType: 'LICENSE', relationType: 'VERIFIED_BY', targetType: 'BOARD' },

      { sourceType: 'DEA', relationType: 'DEPENDS_ON', targetType: 'LICENSE' },

      { sourceType: 'PRIVILEGE', relationType: 'DEPENDS_ON', targetType: 'LICENSE' },
      { sourceType: 'PRIVILEGE', relationType: 'DEPENDS_ON', targetType: 'PAYER' },
      { sourceType: 'PRIVILEGE', relationType: 'BELONGS_TO', targetType: 'ORG' },

      { sourceType: 'PAYER', relationType: 'DEPENDS_ON', targetType: 'PECOS' },
      { sourceType: 'PAYER', relationType: 'DEPENDS_ON', targetType: 'MEDICAID' },
      { sourceType: 'PAYER', relationType: 'IN_CONFLICT_WITH', targetType: 'PAYER' },

      { sourceType: 'VC', relationType: 'BELONGS_TO', targetType: 'CLINICIAN' },
      { sourceType: 'VC', relationType: 'DEPENDS_ON', targetType: 'LICENSE' },
      { sourceType: 'VC', relationType: 'VERIFIED_BY', targetType: 'ORG' },

      { sourceType: 'EVENT', relationType: 'BELONGS_TO', targetType: 'CLINICIAN' },
      { sourceType: 'EVENT', relationType: 'DEPENDS_ON', targetType: 'LICENSE' },
      { sourceType: 'EVENT', relationType: 'DEPENDS_ON', targetType: 'PRIVILEGE' },
      { sourceType: 'EVENT', relationType: 'DEPENDS_ON', targetType: 'PAYER' },

      { sourceType: 'COMPACT', relationType: 'ELIGIBLE_IN', targetType: 'STATE' },
      { sourceType: 'MEDICAID', relationType: 'BELONGS_TO', targetType: 'STATE' },
    ];

    edgeRules.forEach((rule) => registry.registerEdgeRule(rule));

    registry
      .registerRequiredNode('CLINICIAN')
      .registerRequiredNode('ORG');

    registry.registerIllegalCycleRule({
      relationType: 'IN_CONFLICT_WITH',
      nodeTypes: ['PAYER'],
      description: 'Payer conflict edges cannot form directed cycles',
    });

    return registry;
  }

  registerEdgeRule(rule: EdgeRule): this {
    if (!this.allowedEdgeMatrix.has(rule.sourceType)) {
      this.allowedEdgeMatrix.set(rule.sourceType, new Map());
    }

    const relationMap = this.allowedEdgeMatrix.get(rule.sourceType)!;
    if (!relationMap.has(rule.relationType)) {
      relationMap.set(rule.relationType, new Set());
    }

    relationMap.get(rule.relationType)!.add(rule.targetType);
    return this;
  }

  registerRequiredNode(nodeType: GraphNodeType): this {
    this.requiredNodeTypes.add(nodeType);
    return this;
  }

  registerIllegalCycleRule(rule: IllegalCycleRule): this {
    this.illegalCycleRules.push(rule);
    return this;
  }

  assertEdgeAllowed(edge: GraphEdge, nodeLookup: Map<string, GraphNode>): void {
    const source = nodeLookup.get(edge.sourceNodeId);
    const target = nodeLookup.get(edge.targetNodeId);
    if (!source || !target) {
      throw new Error(`Edge references unknown nodes: ${edge.sourceNodeId} -> ${edge.targetNodeId}`);
    }

    if (this.isEdgeAllowed(edge, source.nodeType, target.nodeType)) {
      return;
    }

    throw new Error(
      `Edge ${edge.relationType} from ${source.nodeType} to ${target.nodeType} is not allowed by the graph schema`
    );
  }

  private isEdgeAllowed(edge: GraphEdge, sourceType: GraphNodeType, targetType: GraphNodeType): boolean {
    const relations = this.allowedEdgeMatrix.get(sourceType);
    if (!relations) {
      return false;
    }

    const allowedTargets = relations.get(edge.relationType);
    if (!allowedTargets) {
      return false;
    }

    return allowedTargets.has(targetType);
  }

  validateGraph(graph: GraphData): GraphValidationResult {
    const errors: string[] = [];

    const nodeTypesPresent = new Set<GraphNodeType>();
    graph.nodes.forEach((node) => nodeTypesPresent.add(node.nodeType));

    this.requiredNodeTypes.forEach((nodeType) => {
      if (!nodeTypesPresent.has(nodeType)) {
        errors.push(`Graph is missing required node type ${nodeType}`);
      }
    });

    graph.edges.forEach((edge) => {
      const source = graph.nodes.get(edge.sourceNodeId);
      const target = graph.nodes.get(edge.targetNodeId);

      if (!source || !target) {
        errors.push(`Edge references unknown nodes: ${edge.sourceNodeId} -> ${edge.targetNodeId}`);
        return;
      }

      if (!this.isEdgeAllowed(edge, source.nodeType, target.nodeType)) {
        errors.push(
          `Edge ${edge.relationType} from ${source.nodeType} to ${target.nodeType} violates schema constraints`
        );
      }
    });

    this.illegalCycleRules.forEach((rule) => {
      const cycleErrors = this.detectIllegalCycles(graph, rule);
      errors.push(...cycleErrors);
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private detectIllegalCycles(graph: GraphData, rule: IllegalCycleRule): string[] {
    const adjacency = new Map<string, string[]>();

    graph.edges.forEach((edge) => {
      if (edge.relationType !== rule.relationType) {
        return;
      }

      const source = graph.nodes.get(edge.sourceNodeId);
      const target = graph.nodes.get(edge.targetNodeId);

      if (!source || !target) {
        return;
      }

      if (rule.nodeTypes) {
        if (!rule.nodeTypes.includes(source.nodeType) || !rule.nodeTypes.includes(target.nodeType)) {
          return;
        }
      }

      if (!adjacency.has(source.nodeId)) {
        adjacency.set(source.nodeId, []);
      }

      adjacency.get(source.nodeId)!.push(target.nodeId);
    });

    const visited = new Set<string>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const errors: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      onStack.add(nodeId);
      stack.push(nodeId);

      const neighbors = adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (onStack.has(neighbor)) {
          const cycleStartIdx = stack.indexOf(neighbor);
          const cyclePath = stack.slice(cycleStartIdx).concat(neighbor);
          const readable = cyclePath.join(' -> ');
          errors.push(`${rule.description}: ${readable}`);
          return true;
        }
      }

      stack.pop();
      onStack.delete(nodeId);
      return false;
    };

    adjacency.forEach((_neighbors, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    });

    return errors;
  }
}

export const DefaultGraphSchema = GraphSchemaRegistry.createDefault();

export function buildMinimalGraphForTesting(): GraphData {
  const nodes = new Map<string, GraphNode>();
  const clinician = createGraphNode({ nodeId: 'clinician-graph-test', nodeType: 'CLINICIAN', metadata: {} });
  const org = createGraphNode({ nodeId: 'org-graph-test', nodeType: 'ORG', metadata: {} });
  const license = createGraphNode({ nodeId: 'license-graph-test', nodeType: 'LICENSE', metadata: {} });

  nodes.set(clinician.nodeId, clinician);
  nodes.set(org.nodeId, org);
  nodes.set(license.nodeId, license);

  const edges: GraphEdge[] = [
    createGraphEdge({
      sourceNodeId: clinician.nodeId,
      targetNodeId: org.nodeId,
      relationType: 'BELONGS_TO',
    }),
    createGraphEdge({
      sourceNodeId: clinician.nodeId,
      targetNodeId: license.nodeId,
      relationType: 'HAS_LICENSE',
    }),
  ];

  return { nodes, edges };
}

