/**
 * @vitalcv/domain-evidence — public barrel.
 *
 * Typed facade over existing evidence; pure transforms only. See
 * docs/wave215/C3-domain-evidence-package.md for the architecture.
 */

export type {
  EvidenceClass,
  EvidenceCollection,
  EvidenceLifecycle,
  EvidenceObject,
  EvidenceProvenance,
  EvidenceRelationship,
  EvidenceRelationshipType,
  EvidenceSource,
  EvidenceStatus,
  EvidenceValue,
} from './types';

export {
  EVIDENCE_CLASSES,
  EVIDENCE_STATUSES,
  buildEvidenceCollection,
  isDecisionGradeStatus,
  summarizeEvidenceCoverage,
  type BuildEvidenceCollectionInput,
} from './collection';

export {
  GRAPH_RELATIONSHIP_TYPES,
  projectEvidenceToGraph,
  statusTrustScore,
  type GraphNode,
  type GraphNodeType,
  type GraphProjection,
  type GraphRelationship,
  type GraphRelationshipType,
} from './projectors/graph';

export {
  TRUST_DIMENSIONS,
  propagateTrust,
  type DimensionTrust,
  type TrustDimension,
  type TrustHistory,
  type TrustHistoryEntry,
  type TrustHistoryEventType,
  type TrustProjection,
} from './trust/propagate';

export {
  CAREER_EVENT_TYPES,
  projectTimeline,
  type CareerEvent,
  type CareerEventType,
  type MobilityImpact,
  type RecognitionImpact,
  type ReputationStanding,
  type ReputationSummary,
  type TimelineProjection,
} from './timeline/timeline';

export {
  defaultReadinessTemplate,
  deriveMobilityOverview,
  detectGaps,
  projectReadiness,
  type EvidenceRequirement,
  type ExperienceRequirement,
  type Gap,
  type GapKind,
  type GapRemediation,
  type GapReport,
  type MobilityOverview,
  type MobilityReadiness,
  type OpportunityObject,
  type OpportunityRequirement,
  type ReadinessProjection,
  type RequirementNecessity,
  type TrustRequirement,
} from './mobility/mobility';

export {
  projectOrganizations,
  type ClinicianOrganizationRelationship,
  type OrganizationGraph,
  type OrganizationKind,
  type OrganizationNode,
} from './organizations/organizations';
