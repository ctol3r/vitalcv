import { describe, expect, it } from '@jest/globals';

import { GraphBuilder } from '../builder/graphBuilder.js';
import { DefaultGraphSchema } from '../schemaRegistry.js';
import { GraphNodeType } from '../models/GraphNode.js';
import { GraphRelationType } from '../models/GraphEdge.js';
import { buildSampleGraph, createSampleGraphInput } from './graphTestUtils.js';

describe('GraphBuilder', () => {
  it('creates nodes for every credential element in the sample clinician profile', () => {
    const builder = new GraphBuilder();
    const graph = builder.build(createSampleGraphInput());

    const nodeTypes = new Set<GraphNodeType>([...graph.nodes.values()].map((node) => node.nodeType));
    const expectedTypes: GraphNodeType[] = [
      'CLINICIAN',
      'LICENSE',
      'BOARD',
      'DEA',
      'PECOS',
      'MEDICAID',
      'PAYER',
      'PRIVILEGE',
      'ORG',
      'STATE',
      'COMPACT',
      'VC',
      'EVENT',
    ];

    expectedTypes.forEach((type) => {
      expect(nodeTypes.has(type)).toBe(
        true,
        `Expected graph to include node type ${type} but only had ${[...nodeTypes].join(', ')}`
      );
    });
  });

  it('links nodes with typed edges that conform to the schema', () => {
    const graph = buildSampleGraph();
    const schemaValidation = DefaultGraphSchema.validateGraph(graph);

    expect(schemaValidation.valid).toBe(true);
    expect(schemaValidation.errors).toHaveLength(0);

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: 'clinician-sample',
          targetNodeId: 'license-ca',
          relationType: 'HAS_LICENSE' satisfies GraphRelationType,
        }),
        expect.objectContaining({
          sourceNodeId: 'license-ca',
          targetNodeId: 'board-abim',
          relationType: 'VERIFIED_BY' satisfies GraphRelationType,
        }),
        expect.objectContaining({
          sourceNodeId: 'priv-icu',
          targetNodeId: 'payer-blue',
          relationType: 'DEPENDS_ON' satisfies GraphRelationType,
        }),
      ])
    );
  });
});

