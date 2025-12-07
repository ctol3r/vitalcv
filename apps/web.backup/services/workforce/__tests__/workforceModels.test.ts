import {
  WORKFORCE_SUPPLY_NODE_TYPES,
  createWorkforceSupplyNode,
  normalizeSupplyMetadata,
  mergeSupplyMetadata,
} from '../models/WorkforceSupplyNode.js';
import {
  WORKFORCE_SUPPLY_RELATION_TYPES,
  createWorkforceSupplyEdge,
} from '../models/WorkforceSupplyEdge.js';

describe('WorkforceSupplyNode', () => {
  it('creates a node with normalized metadata', () => {
    const node = createWorkforceSupplyNode({
      nodeId: 'clinician:alice',
      nodeType: 'CLINICIAN',
      metadata: {
        specialty: 'Cardiology',
        states: ['CA', 'NV'],
      },
    });

    expect(node.metadata).toEqual({
      specialty: 'Cardiology',
      states: ['CA', 'NV'],
    });
    expect(node.nodeId).toBe('clinician:alice');
    expect(node.nodeType).toBe('CLINICIAN');
    expect(node.createdAt).toBeInstanceOf(Date);
  });

  it('coerces primitive metadata values into objects', () => {
    const metadata = normalizeSupplyMetadata('active');
    expect(metadata).toEqual({ value: 'active' });
  });

  it('merges metadata preferring updates', () => {
    const merged = mergeSupplyMetadata(
      { specialty: 'Cardiology', score: 88 },
      { score: 92, states: ['CA'] },
    );
    expect(merged).toEqual({ specialty: 'Cardiology', score: 92, states: ['CA'] });
  });

  it('throws for invalid node types', () => {
    expect(() =>
      createWorkforceSupplyNode({
        nodeId: 'clinician:bad',
        nodeType: 'INVALID' as (typeof WORKFORCE_SUPPLY_NODE_TYPES)[number],
      }),
    ).toThrow(/invalid/i);
  });
});

describe('WorkforceSupplyEdge', () => {
  it('creates a weighted edge with default metadata', () => {
    const edge = createWorkforceSupplyEdge({
      sourceNodeId: 'clinician:alice',
      targetNodeId: 'state:CA',
      relationType: 'CAN_PRACTICE_IN',
      weight: 3,
      metadata: {
        via: 'LICENSE',
      },
    });

    expect(edge).toEqual({
      sourceNodeId: 'clinician:alice',
      targetNodeId: 'state:CA',
      relationType: 'CAN_PRACTICE_IN',
      weight: 3,
      metadata: { via: 'LICENSE' },
    });
  });

  it('defaults weight to 1 when omitted', () => {
    const edge = createWorkforceSupplyEdge({
      sourceNodeId: 'clinician:alice',
      targetNodeId: 'payer:united',
      relationType: 'COVERED_BY_PAYER',
    });
    expect(edge.weight).toBe(1);
  });

  it('rejects invalid relation types', () => {
    expect(() =>
      createWorkforceSupplyEdge({
        sourceNodeId: 'a',
        targetNodeId: 'b',
        relationType: 'UNKNOWN' as (typeof WORKFORCE_SUPPLY_RELATION_TYPES)[number],
      }),
    ).toThrow(/invalid/i);
  });
});

