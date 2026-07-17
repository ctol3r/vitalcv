/**
 * The gap register — node and edge types in the ontology that cannot be
 * projected from any canonical record today.
 *
 * This file exists so that "we don't have this" is a recorded, tested fact
 * rather than an omission someone later fills with a plausible-looking node.
 * The contract test asserts every ontology member is either projected or
 * registered here, so a new node type cannot be added without deciding which.
 *
 * Nothing in this file may be rendered. A gap is not an empty state to draw —
 * it is a type the graph does not have, and the directive is explicit: no fake
 * nodes for visual density, and no mostly-empty graph.
 */

import type { CareerGraphEdgeType, CareerGraphNodeType } from './types';

export type GapReason =
  /** No table holds this at all. */
  | 'no_persistence'
  /** A table exists but nothing in production writes it, so it would project empty. */
  | 'no_production_writer'
  /** Held only as a scalar on another row; not addressable as its own entity. */
  | 'scalar_only'
  /** Genuinely derived — it should be computed from other nodes, not stored. */
  | 'derived';

export interface NodeGap {
  readonly type: CareerGraphNodeType;
  readonly reason: GapReason;
  /** What exists today, stated precisely. */
  readonly today: string;
  /** What would have to become true before this can project. */
  readonly wouldRequire: string;
}

export interface EdgeGap {
  readonly type: CareerGraphEdgeType;
  readonly reason: GapReason;
  readonly today: string;
  readonly wouldRequire: string;
}

export const NODE_GAPS: readonly NodeGap[] = [
  {
    type: 'wallet',
    reason: 'derived',
    today: 'No Wallet model, and there should not be one. The wallet is the clinician’s view over their own evidence_claim set.',
    wouldRequire: 'Nothing to persist — project it as a derived node fenced to the owning clinician, or drop the node type and let `clinician` anchor the view.',
  },
  {
    type: 'license',
    reason: 'no_persistence',
    today: 'No License model. Licences survive as strings: NursysEvent.licenseNumber, PsvReceipt.licenseId, VcvCredential.credentialType. NPPES taxonomy.license is self-reported with no status.',
    wouldRequire: 'A License table with issuing board, number, status and observation time — and an honest source. Physician licensure is manual today under the no-paid-sources policy.',
  },
  {
    type: 'facility',
    reason: 'no_persistence',
    today: 'No Facility model. Institution is the closest real table; elsewhere facility is a string (Acceptance.facilityId, StartAttestation.facility, VcvEntityType.FACILITY).',
    wouldRequire: 'Either promote Institution to the facility node, or add a Facility table. Note domain-common already exports AuthorityFacility/FacilityPrivilegeCredential types with no table behind them.',
  },
  {
    type: 'requirement',
    reason: 'scalar_only',
    today: 'No Requirement model. Opportunity.requirementLevel is a String @default("L1"); OrganizationProfile.requirements is Json.',
    wouldRequire: 'A Requirement table addressable per opportunity. Without it there is no requires/satisfies edge, so "why this matched" cannot be shown as a graph path.',
  },
  {
    type: 'recommendation',
    reason: 'no_persistence',
    today: 'No match table. Scores are computed on the fly by scoreOpportunity and returned, never persisted. MatchBoost is called at matchBoostService.ts:84 on a model that exists in no schema and no migration, hidden by a // @ts-nocheck.',
    wouldRequire: 'A recommendation/match table, plus deleting or backing the phantom matchBoost delegate (it currently throws a live 500 via learningAnalytics.ts).',
  },
  {
    type: 'clarification',
    reason: 'no_persistence',
    today: 'No Clarification model; zero references repo-wide.',
    wouldRequire: 'A Clarification table linked to an application and a requesting reviewer.',
  },
  {
    type: 'specialty',
    reason: 'no_production_writer',
    today: 'SpecialtyTaxonomy exists as reference data with a single writer. Everywhere a clinician has a specialty it is a bare String, so specialties are not addressable entities.',
    wouldRequire: 'A written join from clinician/opportunity to SpecialtyTaxonomy rather than free-text specialty strings.',
  },
  {
    type: 'methodology',
    reason: 'scalar_only',
    today: 'No Methodology model. methodologyVersion is a String on ApplicationPacket, DecisionCapsule, ProviderDecisionState, TrustScoreHistory.',
    wouldRequire: 'A methodology-version table, if versions ever need to be addressable. Carrying it as edge metadata may be sufficient and cheaper.',
  },
];

export const EDGE_GAPS: readonly EdgeGap[] = [
  {
    type: 'requires',
    reason: 'scalar_only',
    today: 'Blocked on the `requirement` node — requirementLevel is a scalar.',
    wouldRequire: 'The Requirement table.',
  },
  {
    type: 'satisfies',
    reason: 'no_persistence',
    today: 'Nothing records that a given evidence_claim satisfies a given requirement. This is the single most valuable missing edge: it is what "accepted as a head start" means.',
    wouldRequire: 'Requirement table + a satisfaction assessment. Must never be inferred and presented as fact — the reviewer retains final authority.',
  },
  {
    type: 'partially_satisfies',
    reason: 'no_persistence',
    today: 'Same as satisfies.',
    wouldRequire: 'Same as satisfies, plus an explicit limitation note.',
  },
  {
    type: 'matched_to',
    reason: 'no_persistence',
    today: 'Matches are computed and discarded; no row records that a clinician was matched to an opportunity.',
    wouldRequire: 'The recommendation table.',
  },
  {
    type: 'explained_by',
    reason: 'no_persistence',
    today: 'Match reasons are computed alongside scores and not persisted, so a match path cannot be replayed as it was shown.',
    wouldRequire: 'Persisted recommendation + its reason set, pinned to a methodology version.',
  },
  {
    type: 'located_at',
    reason: 'no_persistence',
    today: 'Blocked on the `facility` node.',
    wouldRequire: 'Facility node (or Institution promoted to it). ProviderLocation → GeographicBoundary is real and may serve part of this.',
  },
  {
    type: 'requested_clarification',
    reason: 'no_persistence',
    today: 'Blocked on the `clarification` node.',
    wouldRequire: 'Clarification table.',
  },
  {
    type: 'revokes',
    reason: 'no_production_writer',
    today: 'Revocation exists in the trust model and revokedAt columns exist, but no projected relationship records one record revoking another.',
    wouldRequire: 'Confirming which revocation path is canonical. Revoked evidence must fail closed, so this edge matters more than its size suggests.',
  },
  {
    type: 'targets_version',
    reason: 'scalar_only',
    today: 'ApplicationPacket freezes a copy of each field value inline; artifactId/receiptId are unversioned, unconstrained string pointers. The packet is sealed by packetHash, so the snapshot is tamper-evident — but it does not link to an immutable evidence version.',
    wouldRequire: 'Versioned evidence identity, so a packet can point at the exact receipt version it presented rather than a copy of the value.',
  },
  {
    type: 'reviewed_by',
    reason: 'no_production_writer',
    today: 'Employer review surfaces exist, but no projected edge records which reviewer reviewed which packet.',
    wouldRequire: 'A reviewer reference on the decision record.',
  },
  {
    type: 'accepted_as_head_start',
    reason: 'scalar_only',
    today: 'EmployerAcceptance.status is a free String defaulting to "ACCEPTED" — every row looks the same. Nothing distinguishes acceptance-as-head-start from any other accept outcome in a projectable way.',
    wouldRequire: 'A structured outcome discriminator on EmployerAcceptance rather than a free-text status.',
  },
  {
    type: 'produced_recognition',
    reason: 'no_persistence',
    today: 'No link from EmployerAcceptance (the review accept) to Recognition (the canonical-path record). They are disjoint subsystems: EmployerAcceptance is keyed on (employerId, clinicianNpi); Recognition on subjectId/recognitionId, both bare strings. Nothing joins an accept to the Recognition it should produce.',
    wouldRequire: 'A recognitionId on EmployerAcceptance, or a bridge that mints a Recognition when an acceptance is recorded. This is the seam between the review surface and the canonical path — today it is an inference, not a record.',
  },
  {
    type: 'recognized_by',
    reason: 'no_production_writer',
    today: 'Recognition.employerId is a bare string with no FK to Organization.',
    wouldRequire: 'An FK (or a validated join) from Recognition to the recognising organization.',
  },
];
