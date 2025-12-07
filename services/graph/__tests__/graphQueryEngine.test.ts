import { describe, expect, it } from '@jest/globals';

import { GraphQueryEngine } from '../queryEngine.js';
import { buildSampleGraph } from './graphTestUtils.js';

describe('GraphQueryEngine', () => {
  const graph = buildSampleGraph();
  const engine = new GraphQueryEngine(graph);

  it('returns typed neighbors for a clinician', () => {
    const neighbors = engine.getNeighbors('clinician-sample', {
      relationTypes: ['HAS_LICENSE'],
    });
    const neighborIds = neighbors.map((node) => node.nodeId);

    expect(neighborIds).toEqual(expect.arrayContaining(['license-ca', 'license-wa']));
  });

  it('finds BFS paths across license dependencies', () => {
    const traversal = engine.bfs('clinician-sample', {
      relationTypes: ['HAS_LICENSE', 'ELIGIBLE_IN'],
      maxDepth: 2,
    });
    const traversedIds = traversal.map((node) => node.nodeId);

    expect(traversedIds).toEqual(expect.arrayContaining(['license-ca', 'state-CA', 'state-WA']));
  });

  it('finds a path from privilege to issuing state', () => {
    const path = engine.findPath('priv-icu', 'state-CA', {
      relationTypes: ['DEPENDS_ON', 'ISSUED_BY'],
    });

    expect(path).not.toBeNull();
    expect(path?.nodes.map((node) => node.nodeId)).toEqual(['priv-icu', 'license-ca', 'state-CA']);
  });

  it('extracts privilege-centric subgraphs', () => {
    const subgraph = engine.getPrivilegeSubgraph('priv-icu');
    const nodeIds = [...subgraph.nodes.keys()];

    expect(nodeIds).toEqual(
      expect.arrayContaining(['priv-icu', 'license-ca', 'board-abim', 'org-bayhealth', 'payer-blue', 'state-CA'])
    );
  });

  it('extracts credential subgraphs for licenses', () => {
    const subgraph = engine.getCredentialSubgraph('license-ca');
    const nodeIds = [...subgraph.nodes.keys()];

    expect(nodeIds).toEqual(
      expect.arrayContaining(['license-ca', 'clinician-sample', 'board-abim', 'state-CA', 'vc-license-ca'])
    );
  });

  it('extracts enrollment subgraphs for payer networks', () => {
    const subgraph = engine.getEnrollmentSubgraph('payer-blue');
    const nodeIds = [...subgraph.nodes.keys()];

    expect(nodeIds).toEqual(
      expect.arrayContaining(['payer-blue', 'payer-gold', 'pecos-555', 'medicaid-ca', 'priv-icu', 'clinician-sample'])
    );
  });
});

