/**
 * Projection rules — the map from canonical records to graph nodes and edges.
 *
 * These are data, not queries. A projection service reads this registry and
 * builds the subgraph; keeping the rules declarative is what lets the contract
 * tests assert coverage without a database.
 *
 * The rule for adding to this file: a node type belongs here only if a real
 * Prisma model holds it AND production code writes it. Anything else goes in
 * `gaps.ts`. "The model exists" is not enough — a model nothing writes projects
 * an empty graph, which is the fake graph in a different costume.
 */

import type { CareerGraphEdgeType, CareerGraphNodeType } from './types';

export interface NodeProjection {
  readonly type: CareerGraphNodeType;
  /** Canonical Prisma model this node is read from. */
  readonly model: string;
  /** Field used as the node's stable id. */
  readonly idField: string;
  /** Field(s) used to render the node's label. */
  readonly labelFields: readonly string[];
  /** Field carrying the record's own state, when it has one. */
  readonly stateField?: string;
  /** Anything a reader needs to not misread this projection. */
  readonly note?: string;
}

export interface EdgeProjection {
  readonly type: CareerGraphEdgeType;
  readonly from: CareerGraphNodeType;
  readonly to: CareerGraphNodeType;
  /** The canonical record the relationship is read from. */
  readonly model: string;
  /** The column(s) carrying the relationship. */
  readonly via: string;
  /**
   * True when a database foreign key enforces this edge. False means a
   * by-convention string join that can dangle — surfaced to the client as
   * `provenance.foreignKeyBacked: false`, never silently equated with a real FK.
   */
  readonly foreignKeyBacked: boolean;
  readonly note?: string;
}

/**
 * Nodes projectable today. Every entry was verified against
 * apps/api/backend/prisma/schema.prisma on origin/main and traced to a live
 * production writer.
 */
export const NODE_PROJECTIONS: readonly NodeProjection[] = [
  {
    type: 'clinician',
    model: 'PersonProfile',
    idField: 'id',
    labelFields: ['fullName'],
    note: 'npi is @unique here; User is the auth record, PersonProfile is the person.',
  },
  {
    type: 'identity',
    model: 'ClinicianIdentity',
    idField: 'clinicianId',
    labelFields: ['clinicianId'],
    note: 'The record is (clinicianId, data Json) — the identity content is an opaque blob, so nothing but the key is projectable from columns. A label beyond the id requires reading into data.',
  },
  {
    type: 'npi',
    model: 'NpiOwnership',
    idField: 'npi',
    labelFields: ['npi'],
    stateField: 'verificationMethod',
    note: 'The claim of an NPI by a user. revokedAt non-null ⇒ the claim is withdrawn and the node must not project.',
  },
  {
    type: 'evidence_claim',
    model: 'ClaimRecord',
    idField: 'claimId',
    labelFields: ['claimType'],
    stateField: 'state',
    note: 'Written in production via a cast-resolved delegate at identityStore.ts:451 (invisible to grep). Bootstrapped by /passport ingest.',
  },
  {
    type: 'source_receipt',
    model: 'VerificationReceiptRecord',
    idField: 'id',
    labelFields: ['sourceId'],
    stateField: 'state',
  },
  { type: 'credential', model: 'VcvCredential', idField: 'id', labelFields: ['credentialType'] },
  {
    type: 'preference',
    model: 'MatchaPreference',
    idField: 'id',
    labelFields: ['clerkUserId'],
    note: 'Durable and reaches the scorer via /api/matcha/score. NOT via /api/matcha/intent, which is an in-memory Map that persists nothing.',
  },
  { type: 'organization', model: 'Organization', idField: 'id', labelFields: ['name'] },
  { type: 'opportunity', model: 'Opportunity', idField: 'id', labelFields: ['title'] },
  { type: 'application', model: 'Application', idField: 'id', labelFields: ['id'], stateField: 'status' },
  {
    type: 'application_packet',
    model: 'ApplicationPacket',
    idField: 'id',
    labelFields: ['purpose', 'packetVersion'],
    note: 'Sealed by packetHash. Identifiers are frozen strings by design so the packet replays without rereading current state.',
  },
  {
    type: 'consent_receipt',
    model: 'AuditEvent',
    idField: 'id',
    labelFields: ['type'],
    note: "No ConsentReceipt model exists. This is AuditEvent filtered to type='application_consent', written in the same transaction as the packet.",
  },
  {
    type: 'decision',
    model: 'EmployerDecisionEvent',
    idField: 'id',
    labelFields: ['decision'],
    stateField: 'decision',
    note: 'ISLAND. Real and written, but FK’d only to VcvEntity and VcvOrganizationContext — it references neither Application nor Recognition. So the decision that is supposed to sit between "employer reviewed a packet" and "Recognition was produced" connects to neither. See the decided_by / produced_recognition / accepted_as_head_start gaps.',
  },
  {
    type: 'decision_capsule',
    model: 'DecisionCapsule',
    idField: 'id',
    labelFields: ['id'],
    note: 'Declares zero FKs; subjectDid, subjectNpi, credentialIds[] and issuerIds[] are unconstrained.',
  },
  {
    type: 'recognition',
    model: 'Recognition',
    idField: 'recognitionId',
    labelFields: ['recognitionId'],
    stateField: 'revokedAt',
    note: 'recognitionId (not id) is the business key other records join on. revokedAt non-null must fail closed.',
  },
  {
    type: 'start_attestation',
    model: 'Start',
    idField: 'id',
    labelFields: ['id'],
    note: 'Projects from Start, not StartAttestation. Three competing models exist — Start (relation-connected to Acceptance), StartAttestation (bare acceptanceId, index only), and StartActivation (schema states "No FK constraints"). Start is the only one reachable through the canonical Recognition → Acceptance chain; the duplication is unresolved and worth resolving before this node is load-bearing.',
  },
  {
    type: 'source',
    model: 'SourceRun',
    idField: 'sourceId',
    labelFields: ['sourceId'],
    note: 'There is no source-registry table; sourceId is an unconstrained string on every table. This projects the distinct sourceIds actually observed, not a curated registry.',
  },
];

/**
 * Edges projectable today.
 *
 * Note how many are `foreignKeyBacked: false`. That is the honest state of the
 * schema, not sloppiness in this file — several of the most semantically central
 * relationships are string joins the database does not enforce.
 */
export const EDGE_PROJECTIONS: readonly EdgeProjection[] = [
  {
    type: 'owns',
    from: 'clinician',
    to: 'npi',
    model: 'NpiOwnership',
    via: 'userId + npi',
    foreignKeyBacked: false,
    note: 'NpiOwnership declares no @relation: userId does not FK to User, and there is no NPI table for npi to FK to. The @@unique([userId, npi]) enforces one claim per pair, not that either side exists.',
  },
  {
    type: 'has_identity',
    from: 'clinician',
    to: 'identity',
    model: 'ClinicianIdentity',
    via: 'clinicianId',
    foreignKeyBacked: false,
    note: 'clinicianId is a bare unique String with no @relation. Whether it holds a User id, a PersonProfile id, or an NPI is not enforced by the schema and must be established before this edge is trusted.',
  },
  {
    type: 'holds',
    from: 'clinician',
    to: 'evidence_claim',
    model: 'ClaimRecord',
    via: 'subjectNpi',
    foreignKeyBacked: false,
    note: 'Joined on NPI string, not a person FK.',
  },
  {
    type: 'backed_by',
    from: 'evidence_claim',
    to: 'source_receipt',
    model: 'VerificationReceiptRecord',
    via: 'claimRecordId',
    foreignKeyBacked: true,
  },
  {
    type: 'observed_by',
    from: 'evidence_claim',
    to: 'source',
    model: 'ClaimRecord',
    via: 'sourceRecordId → SourceRecord.sourceId',
    foreignKeyBacked: true,
  },
  {
    type: 'supersedes',
    from: 'evidence_claim',
    to: 'evidence_claim',
    model: 'VerificationArtifact',
    via: 'supersededBy / supersedes',
    foreignKeyBacked: true,
    note: 'Real self-referential lineage — the spine of "what changed since".',
  },
  {
    type: 'states_preference',
    from: 'clinician',
    to: 'preference',
    model: 'MatchaPreference',
    via: 'clerkUserId',
    foreignKeyBacked: false,
    note: 'MatchaPreference declares no relations at all, not even to User. Written directly by the web app (app/api/matcha/preferences/route.ts), which swallows failures and returns ok:false with status 200 — so absence of a preference node is not evidence the clinician stated none.',
  },
  {
    type: 'offered_by',
    from: 'opportunity',
    to: 'organization',
    model: 'Opportunity',
    via: 'organizationId',
    foreignKeyBacked: true,
  },
  {
    type: 'interested_in',
    from: 'clinician',
    to: 'opportunity',
    model: 'OpportunityAction',
    via: "opportunityId where action in ('saved','connected')",
    foreignKeyBacked: false,
    note: 'opportunityId is a bare String, not @db.Uuid like Opportunity.id — it does not join cleanly. Private to the clinician; never visible to employers.',
  },
  {
    type: 'passed_on',
    from: 'clinician',
    to: 'opportunity',
    model: 'OpportunityAction',
    via: "opportunityId where action = 'declined'",
    foreignKeyBacked: false,
    note: 'Private to the clinician. Employers must never see a pass.',
  },
  {
    type: 'applied_to',
    from: 'clinician',
    to: 'opportunity',
    model: 'Application',
    via: 'opportunityId',
    foreignKeyBacked: true,
  },
  {
    type: 'presented_in',
    from: 'application',
    to: 'application_packet',
    model: 'ApplicationPacket',
    via: 'applicationId',
    foreignKeyBacked: true,
    note: "The packet's only real FK.",
  },
  {
    type: 'consented_to',
    from: 'application_packet',
    to: 'consent_receipt',
    model: 'ApplicationPacket',
    via: 'consentReceiptId → AuditEvent.id',
    foreignKeyBacked: false,
    note: 'Written atomically with the packet, but no FK — audit_events rows can be deleted out from under it.',
  },
  {
    type: 'started_at',
    from: 'recognition',
    to: 'start_attestation',
    model: 'Acceptance',
    via: 'Recognition.recognitionId ← Acceptance.recognitionId → Acceptance.starts (Start[])',
    foreignKeyBacked: true,
    note: 'Both hops are declared relations: Acceptance.recognition references Recognition on the recognitionId business key, and Acceptance.starts is a real relation to Start. This chain — Recognition → Acceptance → Start — is the canonical path, and it is the strongest real subgraph in the product.',
  },
];
