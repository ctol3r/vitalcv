import { describe, expect, it } from '@jest/globals';

import { createGraphEdge } from '../models/GraphEdge.js';
import { createGraphNode } from '../models/GraphNode.js';
import { GraphSchemaRegistry, buildMinimalGraphForTesting } from '../schemaRegistry.js';

describe('GraphSchemaRegistry', () => {
  it('validates graphs that satisfy the default schema', () => {
    const schema = GraphSchemaRegistry.createDefault();
    const graph = buildMinimalGraphForTesting();
    const result = schema.validateGraph(graph);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags graphs that omit required node types', () => {
    const schema = GraphSchemaRegistry.createDefault();
    const graph = buildMinimalGraphForTesting();

    graph.nodes.delete('org-graph-test');
    const sanitizedEdges = graph.edges.filter((edge) => edge.targetNodeId !== 'org-graph-test');
    const result = schema.validateGraph({ nodes: graph.nodes, edges: sanitizedEdges });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('ORG'))).toBe(true);
  });

  it('detects illegal payer conflict cycles', () => {
    const schema = GraphSchemaRegistry.createDefault();
    const baseGraph = buildMinimalGraphForTesting();

    const nodes = new Map(baseGraph.nodes);
    nodes.set('payer-blue', createGraphNode({ nodeId: 'payer-blue', nodeType: 'PAYER', metadata: {} }));
    nodes.set('payer-gold', createGraphNode({ nodeId: 'payer-gold', nodeType: 'PAYER', metadata: {} }));

    const edges = [
      ...baseGraph.edges,
      createGraphEdge({
        sourceNodeId: 'clinician-graph-test',
        targetNodeId: 'payer-blue',
        relationType: 'DEPENDS_ON',
      }),
      createGraphEdge({
        sourceNodeId: 'payer-blue',
        targetNodeId: 'payer-gold',
        relationType: 'IN_CONFLICT_WITH',
      }),
      createGraphEdge({
        sourceNodeId: 'payer-gold',
        targetNodeId: 'payer-blue',
        relationType: 'IN_CONFLICT_WITH',
      }),
    ];

    const result = schema.validateGraph({ nodes, edges });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Payer conflict edges cannot form directed cycles')])
    );
  });
});

