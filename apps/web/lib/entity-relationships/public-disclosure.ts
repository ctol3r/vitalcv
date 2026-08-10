/**
 * Public disclosure policy for the NPI-keyed relationships endpoint (ADR 0006).
 *
 * `GET /api/entities/clinician/<npi>/relationships` is public and unauthenticated.
 * ADR 0006 (docs/adr/0006-graph-backlinks-authz-consent.md) requires that what it
 * returns be an EXPLICIT, TESTED allow-list of independently-public facts rather
 * than "whatever the shared evidence projection happens to emit today" — because
 * the projection is shared with authenticated surfaces and grows over time.
 *
 * ── Why this filters NODES, not edges ────────────────────────────────────────
 *
 * The obvious reading of ADR 0006 is "allow-list the backlink edge types". That is
 * not sufficient here, for two reasons the edge-type framing hides:
 *
 *  1. The sensitive edge is OUTGOING, not a backlink. `projectEvidenceToGraph`
 *     emits peer-review evidence as `subject --REVIEWED_BY--> evidence`, so it sits
 *     in the `outgoing` half that ADR 0006 proposed shipping unfiltered. The
 *     disclosure risk does not respect the outgoing/backlink split, so neither
 *     does this policy — it is direction-agnostic.
 *  2. `?focus=<nodeId>` accepts ANY node id in the projection. Dropping an edge by
 *     type still leaves its endpoints reachable: focus the peer-review source node
 *     and its remaining `VERIFIED_BY` backlinks re-disclose exactly what the edge
 *     filter removed.
 *
 * So a non-public evidence object is removed from the collection BEFORE projection.
 * Its node never exists, none of its edges exist, and no `?focus=` value can reach
 * it. The edge-type allow-list below is retained as an independent second
 * assertion (see entity-relationships-public-disclosure.test.ts) — if the two ever
 * disagree, the projector changed under us and the test fails.
 *
 * ── Default-deny ─────────────────────────────────────────────────────────────
 *
 * Both allow-lists are enumerated positively. A new `EvidenceClass` or
 * `GraphRelationshipType` added upstream is NON-PUBLIC until someone adds it here
 * deliberately, and the exhaustiveness test fails until they do. That is the
 * "cannot silently leak" guarantee ADR 0006 asks for.
 */

import {
  buildEvidenceCollection,
  type EvidenceClass,
  type EvidenceCollection,
  type GraphRelationshipType,
} from '@vitalcv/domain-evidence';

/**
 * Evidence classes a public, unauthenticated, NPI-keyed viewer may see.
 *
 * Each is already published for this NPI by `/verify/:npi` on its own terms:
 * identity/licensure/certification/registration/exclusion/enrollment are the
 * public trust lanes; publications and research are public scholarly record;
 * training is the clinician's own published education history.
 */
export const PUBLIC_EVIDENCE_CLASSES: ReadonlySet<EvidenceClass> = new Set([
  'identity',
  'licensure',
  'board_cert',
  'registration',
  'exclusion',
  'enrollment',
  'research',
  'publication',
  'training',
]);

/**
 * Evidence classes that must NEVER appear in the public response, each with the
 * reason it is excluded. Kept as an explicit map (not merely "the complement") so
 * the exclusion is a stated decision with a rationale attached, and so the
 * exhaustiveness test can prove every class is classified one way or the other.
 */
export const NON_PUBLIC_EVIDENCE_CLASSES: Readonly<Record<string, string>> = {
  peer_review:
    'NPDB / peer review. The EXISTENCE of the edge discloses that a peer-review ' +
    'record was consulted for this clinician, independent of its status or value. ' +
    'Never public.',
  privilege:
    'Clinical privileges are granted by a named institution and are not published ' +
    'per-NPI by any public source.',
  recognition:
    'Employer recognition. Individually readable elsewhere, but aggregating every ' +
    'recognizing employer behind one NPI-keyed call is the profiling surface ADR ' +
    '0006 was written to prevent.',
  acceptance: 'Employer acceptance — same aggregation concern as recognition.',
  start: 'Employment start — reveals the hiring outcome and the employer.',
  employment: 'Employment relationship — reveals current and past employers.',
};

/**
 * Relationship types the public response may contain. This is the closure of
 * PUBLIC_EVIDENCE_CLASSES under the projector's own subject->evidence and
 * evidence->source labelling, held here independently so a change in either the
 * projector or the class list is caught rather than absorbed.
 */
export const PUBLIC_RELATIONSHIP_TYPES: ReadonlySet<GraphRelationshipType> = new Set([
  // subject -> evidence
  'HAS_IDENTITY',
  'HOLDS_LICENSE',
  'HOLDS_CERTIFICATION',
  'HOLDS_REGISTRATION',
  'SCREENED_FOR_EXCLUSION',
  'ENROLLED_IN',
  'AUTHORED',
  'TRAINED_AT',
  // evidence -> source
  'VERIFIED_BY',
  'CERTIFIED_BY',
]);

/** True when this evidence class may be shown to an unauthenticated viewer. */
export function isPublicEvidenceClass(evidenceClass: EvidenceClass): boolean {
  return PUBLIC_EVIDENCE_CLASSES.has(evidenceClass);
}

/** True when this relationship type may appear in the public response. */
export function isPublicRelationshipType(type: GraphRelationshipType): boolean {
  return PUBLIC_RELATIONSHIP_TYPES.has(type);
}

/**
 * Reduce an EvidenceCollection to the objects a public viewer may see.
 *
 * Non-public objects are dropped, and so is any declared relationship touching a
 * dropped object — leaving a dangling relationship would re-disclose the evidence
 * id we just removed. The result is a well-formed collection, so downstream
 * projection needs no knowledge of this policy.
 */
export function toPublicEvidenceCollection(collection: EvidenceCollection): EvidenceCollection {
  const objects = collection.objects.filter((obj) => isPublicEvidenceClass(obj.evidenceClass));
  const keptIds = new Set(objects.map((obj) => obj.evidenceId));

  // Both endpoints must be clear, not just `from`. Today's producer always sets
  // `to` to a sourceId, so the `to` check is a no-op — but `EvidenceRelationship.to`
  // is documented as "evidenceId, sourceId, or entity key", and `derived_from` /
  // `supersedes` / `proven_by` are evidence-to-evidence by nature. The moment one of
  // those is emitted, filtering on `from` alone would keep an edge POINTING AT a
  // dropped object and re-disclose the evidenceId we just removed.
  const droppedIds = new Set(
    collection.objects
      .filter((obj) => !isPublicEvidenceClass(obj.evidenceClass))
      .map((obj) => obj.evidenceId),
  );

  const relationships = (collection.relationships ?? []).filter(
    (rel) => keptIds.has(rel.from) && !droppedIds.has(rel.to),
  );

  return buildEvidenceCollection({
    subjectKey: collection.subjectKey,
    generatedFor: collection.generatedFor,
    objects,
    relationships,
  });
}
