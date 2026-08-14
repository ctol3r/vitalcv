/**
 * ADR 0006 contract test — the disclosure boundary on the four PUBLIC, NPI-keyed
 * graph routes that share the passport -> evidence -> projection chain:
 *
 *   GET /api/graph/[entityId]                          (GraphProjection)
 *   GET /api/graph/[entityId]/trust                    (TrustProjection)
 *   GET /api/knowledge-graph/[entityId]                (KnowledgeGraph + ?kind=/?q= search)
 *   GET /api/knowledge-graph/[entityId]/subgraph       (bounded BFS, ?root=/?depth=)
 *
 * `entity-relationships-public-disclosure.test.ts` guards the SAME policy on
 * /api/entities/[type]/[id]/relationships. This file exists because that route was
 * not the only consumer: these four ran the identical chain with no filter, so the
 * boundary held on one endpoint and not on its four siblings.
 *
 * ── Why this asserts through the ROUTE HANDLER ───────────────────────────────
 *
 * The policy module is already unit-tested. What was actually broken here was
 * WIRING — the filter existed and simply was not called. A test of the chain would
 * have passed on all four routes while all four leaked. So every assertion below
 * runs the real exported `GET`, and the leak arm reproduces each route's chain
 * MINUS the filter to prove the fixture reaches the projector at all. A clean
 * result in the guarded arm means nothing unless the unguarded arm is dirty.
 *
 * ── The fixture ──────────────────────────────────────────────────────────────
 *
 * A source-coverage check with sourceId `NPDB`. `classifyEvidenceClass` maps any
 * id containing "npdb" to `peer_review`, the load-bearing non-public class: the
 * mere EXISTENCE of the record discloses that a peer-review file was consulted for
 * this clinician, independent of its status or value.
 *
 * NOTE: no live source emits an NPDB check today, so applying the filter is a
 * zero-behavior-change hardening at the time of writing — but the classifier path
 * is live, not dead code, and the day a producer appears these routes would have
 * published it. `emits peer_review evidence at all` below pins that potency: if the
 * classifier stops producing `peer_review`, this file fails loudly rather than
 * passing vacuously.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({
  resolvePassportRuntimePassport: resolveMock,
}));

import {
  buildKnowledgeGraph,
  indexKnowledgeGraph,
  projectEvidenceToGraph,
  propagateTrust,
  traverseSubgraph,
  type EvidenceClass,
} from '@vitalcv/domain-evidence';

import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { assertPassportData } from '../lib/trust/passport-contract';
import {
  NON_PUBLIC_EVIDENCE_CLASSES,
  PUBLIC_EVIDENCE_CLASSES,
} from '../lib/entity-relationships/public-disclosure';

const ENTITY_ID = 'entity-1';

/** Non-public fixture: sourceId contains "npdb" -> classified `peer_review`. */
const NPDB_SOURCE_ID = 'NPDB';
const NPDB_EVIDENCE_ID = 'coverage:NPDB';
const NPDB_SOURCE_NODE = 'source:NPDB';

/** A public control that must SURVIVE, so an empty response cannot pass as "filtered". */
const LICENSE_EVIDENCE_ID = 'coverage:STATE_BOARD';

function buildPassportPayload() {
  return {
    entityId: ENTITY_ID,
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: { credentials: [], summary: { active: 0, expired: 0, stale: 0, missing: [] } },
    training: { records: [], hasDegree: false, degreeVerified: false, hasResidency: false, fellowshipCount: 0 },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: null,
      negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 70, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 14, nextActions: [] },
    sources: { checked: ['NPPES_API'], lastFetch: { NPPES_API: '2026-03-23T12:00:00.000Z' } },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-23T12:00:00.000Z' },
        { sourceId: 'STATE_BOARD', state: 'checked', reason: 'Licensure verified', checkedAt: '2026-03-23T12:00:00.000Z' },
        // ── THE INJECTION ──────────────────────────────────────────────────────
        // `checked` deliberately, not `pending`: a decision-grade record earns a
        // positive trustScore, so it lands in DimensionTrust.supporting BY ID and
        // in .origins BY SOURCE. A pending record would leak more quietly and make
        // this a weaker test.
        { sourceId: NPDB_SOURCE_ID, state: 'checked', reason: 'Peer review consulted', checkedAt: '2026-03-23T12:00:00.000Z' },
      ],
    },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: 70,
      dimensions: [],
      freshness: { state: 'partial', label: 'Partial source coverage', items: [] },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
  };
}

const passport = () => assertPassportData(buildPassportPayload());
const collection = () => passportToEvidenceCollection(passport());

const ctx = (entityId: string) => ({ params: Promise.resolve({ entityId }) });
const req = (url = 'http://localhost/api/test') => new NextRequest(url);

/** Case-insensitive: the evidenceId keeps the source's original casing. */
const mentionsNpdb = (value: unknown) => JSON.stringify(value).toLowerCase().includes('npdb');

beforeEach(() => {
  resolveMock.mockReset();
  resolveMock.mockResolvedValue(passport());
});

// ─────────────────────────────────────────────────────────────────────────────

describe('ADR 0006 — the fixture is potent (anti-vacuity)', () => {
  it('emits peer_review evidence at all', () => {
    const objects = collection().objects;
    const npdb = objects.find((o) => o.evidenceId === NPDB_EVIDENCE_ID);

    expect(
      npdb,
      'the NPDB coverage check produced no evidence object — the injection never ' +
        'reached the chain, so every "no leak" assertion in this file is vacuous',
    ).toBeDefined();
    expect(
      npdb?.evidenceClass,
      'classifyEvidenceClass no longer maps an "npdb" sourceId to peer_review; ' +
        're-derive the non-public set before trusting this file',
    ).toBe('peer_review');

    // And the class really is non-public per the shared policy.
    expect(PUBLIC_EVIDENCE_CLASSES.has('peer_review' as EvidenceClass)).toBe(false);
    expect(NON_PUBLIC_EVIDENCE_CLASSES.peer_review).toBeTruthy();

    // The public control is present too, so "survives" assertions are meaningful.
    expect(objects.some((o) => o.evidenceId === LICENSE_EVIDENCE_ID)).toBe(true);
  });
});

describe('GET /api/graph/[entityId] — GraphProjection', () => {
  it('PROVES THE GUARD BITES: unfiltered, NPDB appears as an evidence node and a source node', () => {
    const leaked = projectEvidenceToGraph(collection());

    expect(leaked.nodes.some((n) => n.id === NPDB_EVIDENCE_ID)).toBe(true);
    expect(leaked.nodes.some((n) => n.id === NPDB_SOURCE_NODE)).toBe(true);
    expect(leaked.nodes.some((n) => n.evidenceClass === 'peer_review')).toBe(true);
    expect(leaked.relationships.some((r) => r.type === 'REVIEWED_BY')).toBe(true);
  });

  it('serves no non-public evidence class, node, or edge', async () => {
    const { GET } = await import('../app/api/graph/[entityId]/route');
    const res = await GET(req(), ctx(ENTITY_ID));
    expect(res.status).toBe(200);
    const body = await res.json();

    for (const node of body.nodes) {
      if (node.evidenceClass !== null) {
        expect(
          PUBLIC_EVIDENCE_CLASSES.has(node.evidenceClass),
          `node ${node.id} carries non-public evidenceClass "${node.evidenceClass}"`,
        ).toBe(true);
      }
    }
    expect(body.nodes.some((n: { id: string }) => n.id === NPDB_EVIDENCE_ID)).toBe(false);
    expect(body.nodes.some((n: { id: string }) => n.id === NPDB_SOURCE_NODE)).toBe(false);
    expect(body.relationships.some((r: { type: string }) => r.type === 'REVIEWED_BY')).toBe(false);
    expect(mentionsNpdb(body)).toBe(false);

    // Not vacuous: the public licensure evidence still comes through.
    expect(body.nodes.some((n: { id: string }) => n.id === LICENSE_EVIDENCE_ID)).toBe(true);
    expect(body.stats.nodeCount).toBe(body.nodes.length);
  });
});

describe('GET /api/graph/[entityId]/trust — TrustProjection', () => {
  it('PROVES THE GUARD BITES: unfiltered, NPDB is named in the leadership dimension', () => {
    const leaked = propagateTrust(projectEvidenceToGraph(collection()));
    const leadership = leaked.dimensions.find((d) => d.dimension === 'leadership');

    // peer_review maps to `leadership`, and DimensionTrust carries raw evidenceIds
    // and sourceIds — so this leaks the record by name, not merely as a count.
    expect([...(leadership?.supporting ?? []), ...(leadership?.weakening ?? [])]).toContain(NPDB_EVIDENCE_ID);
    expect(leadership?.origins).toContain(NPDB_SOURCE_ID);
    expect(leadership?.contributingCount).toBeGreaterThan(0);
    expect(leaked.overall.totalEvidence).toBe(3);
  });

  it('names no non-public evidence in any dimension, and does not count it', async () => {
    const { GET } = await import('../app/api/graph/[entityId]/trust/route');
    const res = await GET(req(), ctx(ENTITY_ID));
    expect(res.status).toBe(200);
    const body = await res.json();

    for (const dimension of body.dimensions) {
      expect(dimension.supporting).not.toContain(NPDB_EVIDENCE_ID);
      expect(dimension.weakening).not.toContain(NPDB_EVIDENCE_ID);
      expect(dimension.origins).not.toContain(NPDB_SOURCE_ID);
    }

    const leadership = body.dimensions.find((d: { dimension: string }) => d.dimension === 'leadership');
    expect(leadership.contributingCount).toBe(0);
    expect(leadership.score).toBeNull();

    // The count itself is a disclosure: 3 evidence objects in, 2 public ones out.
    expect(body.overall.totalEvidence).toBe(2);
    expect(mentionsNpdb(body)).toBe(false);
    expect(body.dimensions).toHaveLength(7);
  });
});

describe('GET /api/knowledge-graph/[entityId] — KnowledgeGraph + search', () => {
  it('PROVES THE GUARD BITES: unfiltered, NPDB is an entity and is searchable', () => {
    const leaked = buildKnowledgeGraph(collection());

    expect(leaked.entities.some((e) => e.id === NPDB_EVIDENCE_ID)).toBe(true);
    expect(leaked.entities.some((e) => e.evidenceClass === 'peer_review')).toBe(true);
  });

  it('serves no non-public entity', async () => {
    const { GET } = await import('../app/api/knowledge-graph/[entityId]/route');
    const res = await GET(req(), ctx(ENTITY_ID));
    expect(res.status).toBe(200);
    const body = await res.json();

    for (const entity of body.entities) {
      if (entity.evidenceClass !== null && entity.evidenceClass !== undefined) {
        expect(
          PUBLIC_EVIDENCE_CLASSES.has(entity.evidenceClass),
          `entity ${entity.id} carries non-public evidenceClass "${entity.evidenceClass}"`,
        ).toBe(true);
      }
    }
    expect(body.entities.some((e: { id: string }) => e.id === NPDB_EVIDENCE_ID)).toBe(false);
    expect(mentionsNpdb(body)).toBe(false);
    expect(body.entities.some((e: { id: string }) => e.id === LICENSE_EVIDENCE_ID)).toBe(true);
    expect(body.stats.entityCount).toBe(body.entities.length);
  });

  it('closes the ?q= / ?kind= hole — search cannot surface the removed evidence', async () => {
    const { GET } = await import('../app/api/knowledge-graph/[entityId]/route');

    for (const query of ['?q=npdb', '?q=NPDB', '?kind=evidence', '?kind=source', '?decisionGrade=1']) {
      const res = await GET(req(`http://localhost/api/knowledge-graph/${ENTITY_ID}${query}`), ctx(ENTITY_ID));
      expect(res.status).toBe(200);
      const body = await res.json();

      // Assert on the RESULTS, not the whole body: the route echoes `q` back in
      // `body.query`, and the caller's own search term is not a disclosure. A blunt
      // whole-body string check fails here for a reason that is not a leak.
      expect(mentionsNpdb(body.results), `search "${query}" surfaced non-public evidence`).toBe(false);
      for (const result of body.results) {
        if (result.evidenceClass) {
          expect(PUBLIC_EVIDENCE_CLASSES.has(result.evidenceClass)).toBe(true);
        }
      }
    }
  });

  it('gives ?q=npdb no oracle — the answer is the same as for a term that matches nothing', async () => {
    const { GET } = await import('../app/api/knowledge-graph/[entityId]/route');

    const search = async (q: string) => {
      const res = await GET(req(`http://localhost/api/knowledge-graph/${ENTITY_ID}?q=${q}`), ctx(ENTITY_ID));
      return (await res.json()).results;
    };

    // If the NPDB record were merely hidden from the response rather than removed
    // from the graph, a hit count could still differ and leak its existence.
    expect(await search('npdb')).toEqual([]);
    expect(await search('nothing-matches-this-xyz')).toEqual([]);
  });
});

describe('GET /api/knowledge-graph/[entityId]/subgraph — bounded traversal', () => {
  it('PROVES THE GUARD BITES: unfiltered, ?root= reaches the NPDB node directly', () => {
    const graph = buildKnowledgeGraph(collection());
    const leaked = traverseSubgraph(indexKnowledgeGraph(graph), NPDB_EVIDENCE_ID, 2);

    // This is Amendment A's reachability case: rooting the traversal AT the
    // non-public node returns it, whatever a response-level edge filter would do.
    expect(mentionsNpdb(leaked)).toBe(true);
  });

  it('serves no non-public entity at the default root', async () => {
    const { GET } = await import('../app/api/knowledge-graph/[entityId]/subgraph/route');
    const res = await GET(req(), ctx(ENTITY_ID));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(mentionsNpdb(body)).toBe(false);
    expect(JSON.stringify(body)).toContain(LICENSE_EVIDENCE_ID);
  });

  it('closes the ?root= hole — rooting at the removed node returns nothing', async () => {
    const { GET } = await import('../app/api/knowledge-graph/[entityId]/subgraph/route');

    // Every id an attacker could name for the removed evidence, at max depth.
    for (const root of [NPDB_EVIDENCE_ID, NPDB_SOURCE_NODE, NPDB_SOURCE_ID, 'coverage:npdb', 'source:npdb']) {
      const url = `http://localhost/api/knowledge-graph/${ENTITY_ID}/subgraph?root=${encodeURIComponent(root)}&depth=6`;
      const res = await GET(req(url), ctx(ENTITY_ID));
      expect(res.status).toBe(200);
      const body = await res.json();

      // `rootId` echoes the caller's own parameter, so assert on the payload the
      // traversal actually produced — that is where a disclosure would live.
      expect(body.entities, `?root=${root} returned entities`).toEqual([]);
      expect(body.edges, `?root=${root} returned edges`).toEqual([]);
      expect(mentionsNpdb({ entities: body.entities, edges: body.edges })).toBe(false);
    }
  });

  it('gives ?root= no oracle — a removed node is indistinguishable from one that never existed', async () => {
    const { GET } = await import('../app/api/knowledge-graph/[entityId]/subgraph/route');

    const at = async (root: string) => {
      const url = `http://localhost/api/knowledge-graph/${ENTITY_ID}/subgraph?root=${encodeURIComponent(root)}&depth=6`;
      const body = await (await GET(req(url), ctx(ENTITY_ID))).json();
      // Drop the echoed parameter; compare only what the server chose to reveal.
      const { rootId: _rootId, ...rest } = body;
      return rest;
    };

    // This is the property that makes ?root= safe: the endpoint cannot be used to
    // ask "does this clinician have a peer-review record?" — the answer for the real
    // removed id is byte-identical to the answer for a fabricated one.
    expect(await at(NPDB_EVIDENCE_ID)).toEqual(await at('coverage:THIS-ID-NEVER-EXISTED'));
    expect(await at(NPDB_SOURCE_NODE)).toEqual(await at('source:THIS-ID-NEVER-EXISTED'));
  });
});

describe('ADR 0006 — the boundary holds for every non-public class, not just peer_review', () => {
  /**
   * peer_review is the only non-public class the passport producer can emit today.
   * The other five are employer-side and have no producer in this chain — so this
   * asserts the POLICY the four routes now share, which is what a future producer
   * (an employer-evidence lane feeding the same collection) would meet.
   */
  it('excludes every employer-side class from the public set with a stated reason', () => {
    for (const cls of ['peer_review', 'privilege', 'recognition', 'acceptance', 'start', 'employment']) {
      expect(PUBLIC_EVIDENCE_CLASSES.has(cls as EvidenceClass)).toBe(false);
      expect(NON_PUBLIC_EVIDENCE_CLASSES[cls]?.length ?? 0).toBeGreaterThan(20);
    }
  });
});
