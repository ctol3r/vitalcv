/**
 * ADR 0006 contract test — the public relationships endpoint's disclosure boundary.
 *
 * `GET /api/entities/clinician/<npi>/relationships` is public and unauthenticated.
 * ADR 0006 requires that what it can return be an explicit allow-list, enforced by
 * a test that a future change to the SHARED evidence projection cannot slip past.
 * That is what this file is. It is not a unit test of a helper — it is the guard
 * that lets the endpoint be public at all. If it is deleted or weakened, the
 * endpoint must come down with it.
 *
 * The load-bearing case is `peer_review` (NPDB): the mere EXISTENCE of a
 * peer-review edge discloses that such a record was consulted for this clinician,
 * whatever its status or value. Every assertion below is written so that removing
 * the filter makes it fail — see the "injection" describe block, which reproduces
 * the pre-fix behaviour explicitly and proves the guard catches it.
 */

import { describe, expect, it } from 'vitest';

import {
  buildEvidenceCollection,
  isDecisionGradeStatus,
  projectEvidenceToGraph,
  type EvidenceClass,
  type EvidenceObject,
  type EvidenceRelationship,
} from '@vitalcv/domain-evidence';

import { projectEntityRelationships } from '@/lib/entity-relationships/project';
import {
  NON_PUBLIC_EVIDENCE_CLASSES,
  PUBLIC_EVIDENCE_CLASSES,
  PUBLIC_RELATIONSHIP_TYPES,
  toPublicEvidenceCollection,
} from '@/lib/entity-relationships/public-disclosure';

const SUBJECT_KEY = 'npi:1003000126';
const SUBJECT_NODE = `subject:${SUBJECT_KEY}`;

/**
 * Every EvidenceClass, derived from a Record so TypeScript refuses to compile
 * this file if a class is added upstream and left unclassified here. The runtime
 * list is then used to prove the two allow-lists partition the whole type.
 */
const ALL_EVIDENCE_CLASSES: Record<EvidenceClass, true> = {
  identity: true,
  licensure: true,
  board_cert: true,
  registration: true,
  exclusion: true,
  enrollment: true,
  privilege: true,
  peer_review: true,
  recognition: true,
  acceptance: true,
  start: true,
  employment: true,
  research: true,
  publication: true,
  training: true,
};

function evidence(
  evidenceId: string,
  evidenceClass: EvidenceClass,
  sourceId: string,
  status: EvidenceObject['status'] = 'pending',
): EvidenceObject {
  return {
    evidenceId,
    subjectKey: SUBJECT_KEY,
    evidenceClass,
    label: `${evidenceClass} record`,
    value: {},
    status,
    source: { sourceId, sourceLabel: sourceId, laneType: null, governance: null },
    trustTier: null,
    decisionGrade: isDecisionGradeStatus(status),
    observedAt: null,
    checkedAt: null,
    expiresAt: null,
    freshnessWindowHours: null,
    integrityHash: null,
    provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: 'active',
    supersedes: null,
    supersededBy: null,
  };
}

function collectionOf(objects: EvidenceObject[]) {
  const relationships: EvidenceRelationship[] = objects.map((obj) => ({
    from: obj.evidenceId,
    to: obj.source.sourceId,
    type: 'verified_by',
    confidence: null,
    observedAt: null,
  }));
  return buildEvidenceCollection({
    subjectKey: SUBJECT_KEY,
    generatedFor: { displayName: 'Test Clinician', npi: '1003000126' },
    objects,
    relationships,
  });
}

/** The exact chain the public route runs, so the test exercises the real path. */
function publicGraphOf(objects: EvidenceObject[]) {
  return projectEvidenceToGraph(toPublicEvidenceCollection(collectionOf(objects)));
}

/** The same chain WITHOUT the ADR 0006 filter — i.e. what #748 originally shipped. */
function unfilteredGraphOf(objects: EvidenceObject[]) {
  return projectEvidenceToGraph(collectionOf(objects));
}

const LICENSE = evidence('coverage:state_board', 'licensure', 'state_board');
const NPDB = evidence('coverage:npdb', 'peer_review', 'npdb');

describe('ADR 0006 — the allow-lists are total and default-deny', () => {
  it('classifies every EvidenceClass as either public or explicitly non-public', () => {
    const classes = Object.keys(ALL_EVIDENCE_CLASSES) as EvidenceClass[];

    for (const evidenceClass of classes) {
      const isPublic = PUBLIC_EVIDENCE_CLASSES.has(evidenceClass);
      const isNonPublic = Object.hasOwn(NON_PUBLIC_EVIDENCE_CLASSES, evidenceClass);
      expect(
        isPublic !== isNonPublic,
        `EvidenceClass "${evidenceClass}" must be in exactly one of PUBLIC_EVIDENCE_CLASSES ` +
          'or NON_PUBLIC_EVIDENCE_CLASSES. A new class is non-public until classified deliberately.',
      ).toBe(true);
    }
  });

  it('keeps the employer-side and peer-review classes out of the public set', () => {
    for (const evidenceClass of ['peer_review', 'privilege', 'recognition', 'acceptance', 'start', 'employment']) {
      expect(PUBLIC_EVIDENCE_CLASSES.has(evidenceClass as EvidenceClass)).toBe(false);
      expect(NON_PUBLIC_EVIDENCE_CLASSES[evidenceClass]).toBeTruthy();
    }
  });

  it('states a reason for every exclusion', () => {
    for (const [evidenceClass, reason] of Object.entries(NON_PUBLIC_EVIDENCE_CLASSES)) {
      expect(reason.length, `${evidenceClass} needs a stated reason, not a bare exclusion`).toBeGreaterThan(20);
    }
  });
});

describe('ADR 0006 — no edge outside the allow-list reaches the public response', () => {
  it('emits only allow-listed relationship types for a full public collection', () => {
    const objects = [...PUBLIC_EVIDENCE_CLASSES].map((cls, i) =>
      evidence(`coverage:${cls}`, cls, `source_${i}`),
    );
    const graph = publicGraphOf(objects);
    const rels = projectEntityRelationships(graph, SUBJECT_NODE);

    expect(graph.relationships.length).toBeGreaterThan(0);
    for (const rel of graph.relationships) {
      expect(
        PUBLIC_RELATIONSHIP_TYPES.has(rel.type),
        `relationship type "${rel.type}" is not on the ADR 0006 public allow-list`,
      ).toBe(true);
    }
    for (const view of [...rels.outgoing, ...rels.backlinks]) {
      expect(PUBLIC_RELATIONSHIP_TYPES.has(view.type)).toBe(true);
    }
  });

  it('drops every non-public class from a mixed collection but keeps the public ones', () => {
    const nonPublic = Object.keys(NON_PUBLIC_EVIDENCE_CLASSES).map((cls, i) =>
      evidence(`coverage:np_${i}`, cls as EvidenceClass, `np_source_${i}`),
    );
    const graph = publicGraphOf([LICENSE, ...nonPublic]);

    // The public license survives — the filter is not simply returning nothing.
    expect(graph.nodes.some((n) => n.id === 'coverage:state_board')).toBe(true);
    expect(graph.relationships.some((r) => r.type === 'HOLDS_LICENSE')).toBe(true);

    // Nothing non-public survives, as a node or as an edge.
    for (const obj of nonPublic) {
      expect(graph.nodes.some((n) => n.id === obj.evidenceId)).toBe(false);
      expect(graph.nodes.some((n) => n.id === `source:${obj.source.sourceId}`)).toBe(false);
    }
    for (const rel of graph.relationships) {
      expect(PUBLIC_RELATIONSHIP_TYPES.has(rel.type)).toBe(true);
    }
  });
});

describe('ADR 0006 — injection: an NPDB peer-review record must not surface', () => {
  it('PROVES THE GUARD BITES: without the filter, NPDB leaks as a REVIEWED_BY edge', () => {
    // This is the defect the guard exists to catch, reproduced deliberately. If this
    // assertion ever fails, the projector stopped emitting REVIEWED_BY and the rest of
    // this file is guarding nothing — re-derive the allow-list before trusting it.
    const leaked = unfilteredGraphOf([LICENSE, NPDB]);

    expect(leaked.relationships.some((r) => r.type === 'REVIEWED_BY')).toBe(true);
    expect(leaked.nodes.some((n) => n.id === 'source:npdb')).toBe(true);

    // And it leaks in the OUTGOING direction from the subject — the half ADR 0006
    // originally proposed shipping unfiltered.
    const leakedRels = projectEntityRelationships(leaked, SUBJECT_NODE);
    expect(leakedRels.outgoing.some((r) => r.type === 'REVIEWED_BY')).toBe(true);
  });

  it('removes the peer-review edge, its evidence node, and its source node', () => {
    const graph = publicGraphOf([LICENSE, NPDB]);

    expect(graph.relationships.some((r) => r.type === 'REVIEWED_BY')).toBe(false);
    expect(graph.nodes.some((n) => n.id === 'coverage:npdb')).toBe(false);
    expect(graph.nodes.some((n) => n.id === 'source:npdb')).toBe(false);
    expect(JSON.stringify(graph)).not.toContain('npdb');
  });

  it('closes the ?focus= hole — focusing the removed source or evidence discloses nothing', () => {
    const graph = publicGraphOf([LICENSE, NPDB]);

    // An edge-type filter alone would leave these reachable.
    for (const focus of ['source:npdb', 'coverage:npdb']) {
      const rels = projectEntityRelationships(graph, focus);
      expect(rels.outgoing).toHaveLength(0);
      expect(rels.backlinks).toHaveLength(0);
    }
  });

  it('never leaves a dangling relationship pointing at dropped evidence', () => {
    const filtered = toPublicEvidenceCollection(collectionOf([LICENSE, NPDB]));
    const keptIds = new Set(filtered.objects.map((o) => o.evidenceId));

    for (const rel of filtered.relationships) {
      expect(keptIds.has(rel.from)).toBe(true);
    }
    expect(filtered.relationships.some((r) => r.to === 'npdb')).toBe(false);
  });

  /**
   * The case above only exercises `from`, because the passport producer always sets
   * `to` to a sourceId. But `EvidenceRelationship.to` is documented as "evidenceId,
   * sourceId, or entity key", and `derived_from` / `supersedes` / `proven_by` are
   * evidence-to-evidence by nature. A KEPT public object pointing AT the dropped
   * NPDB record must not survive: the edge would re-disclose the very evidenceId the
   * node-level filter removed. Filtering on `from` alone passes this vacuously today
   * and would leak the day such an edge is emitted.
   */
  it('drops an edge from KEPT evidence that points AT dropped evidence', () => {
    const base = collectionOf([LICENSE, NPDB]);
    const withCrossEdge = buildEvidenceCollection({
      subjectKey: base.subjectKey,
      generatedFor: base.generatedFor,
      objects: base.objects,
      relationships: [
        ...base.relationships,
        // public licensure record claims to be derived from the peer-review record
        {
          from: LICENSE.evidenceId,
          to: NPDB.evidenceId,
          type: 'derived_from',
          confidence: null,
          observedAt: null,
        },
      ],
    });

    const filtered = toPublicEvidenceCollection(withCrossEdge);

    expect(filtered.relationships.some((r) => r.to === NPDB.evidenceId)).toBe(false);
    expect(JSON.stringify(filtered)).not.toContain('npdb');
  });
});
