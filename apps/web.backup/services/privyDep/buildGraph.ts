import type { PrivilegeNode } from './models/PrivilegeNode';
import { indexPrivilegeNodes } from './models/PrivilegeNode';
import type { PrivilegeDependency, PrivilegeDependencyType } from './models/PrivilegeDependency';

export interface PrivilegeEdge {
  code: string;
  dependencyType: PrivilegeDependencyType;
  rationale?: string;
}

export type PrivilegeAdjacencyList = Record<string, PrivilegeEdge[]>;

export interface PrivilegeGraph {
  nodes: PrivilegeNode[];
  dependencies: PrivilegeDependency[];
  adjacency: PrivilegeAdjacencyList;
  reverseAdjacency: PrivilegeAdjacencyList;
  topologicalOrder: string[];
}

export class PrivilegeGraphBuilder {
  private readonly nodeIndex: Map<string, PrivilegeNode>;

  constructor(
    private readonly nodes: PrivilegeNode[],
    private readonly dependencies: PrivilegeDependency[],
  ) {
    this.nodeIndex = indexPrivilegeNodes(nodes);
  }

  build(): PrivilegeGraph {
    const adjacency = this.seedAdjacencyLists();
    const reverseAdjacency = this.seedAdjacencyLists();

    for (const dependency of this.dependencies) {
      this.assertNodeExists(dependency.parentPrivilegeCode);
      this.assertNodeExists(dependency.childPrivilegeCode);

      adjacency[dependency.parentPrivilegeCode].push({
        code: dependency.childPrivilegeCode,
        dependencyType: dependency.dependencyType,
        rationale: dependency.rationale,
      });

      reverseAdjacency[dependency.childPrivilegeCode].push({
        code: dependency.parentPrivilegeCode,
        dependencyType: dependency.dependencyType,
        rationale: dependency.rationale,
      });
    }

    const topologicalOrder = this.computeTopologicalOrder();

    return {
      nodes: this.nodes,
      dependencies: this.dependencies,
      adjacency,
      reverseAdjacency,
      topologicalOrder,
    };
  }

  private seedAdjacencyLists(): PrivilegeAdjacencyList {
    const adjacency: PrivilegeAdjacencyList = {};
    for (const node of this.nodes) {
      adjacency[node.privilegeCode] = [];
    }
    return adjacency;
  }

  private assertNodeExists(code: string) {
    if (!this.nodeIndex.has(code)) {
      throw new Error(`Dependency references unknown privilege code: ${code}`);
    }
  }

  private computeTopologicalOrder(): string[] {
    const indegree = new Map<string, number>();
    for (const node of this.nodes) {
      indegree.set(node.privilegeCode, 0);
    }

    for (const dependency of this.dependencies) {
      indegree.set(
        dependency.childPrivilegeCode,
        (indegree.get(dependency.childPrivilegeCode) ?? 0) + 1,
      );
    }

    const queue: string[] = [];
    for (const [code, degree] of indegree.entries()) {
      if (degree === 0) {
        queue.push(code);
      }
    }

    const order: string[] = [];
    let index = 0;
    while (index < queue.length) {
      const code = queue[index++];
      order.push(code);
      for (const dependency of this.dependencies) {
        if (dependency.parentPrivilegeCode !== code) continue;
        const child = dependency.childPrivilegeCode;
        const nextDegree = (indegree.get(child) ?? 0) - 1;
        indegree.set(child, nextDegree);
        if (nextDegree === 0) {
          queue.push(child);
        }
      }
    }

    if (order.length !== this.nodes.length) {
      throw new Error('Privilege dependency graph contains at least one cycle.');
    }

    return order;
  }
}

export function exportAdjacencyLists(graph: PrivilegeGraph) {
  return {
    prerequisites: graph.reverseAdjacency,
    unlocks: graph.adjacency,
    order: graph.topologicalOrder,
  };
}

