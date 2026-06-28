/**
 * Canonical Career Model (Wave 1000)
 * ──────────────────────────────────────────────────────────────────────────
 * ONE projection layer that composes every career domain — identity, evidence,
 * trust, timeline, mobility, readiness, organizations, growth, intelligence, and
 * a longitudinal (decades-of-history) view — into a single source of truth.
 *
 * Why this exists: every surface (Career OS, Recruiter OS, Organization OS) and
 * every composite route previously orchestrated these projections itself. That
 * is duplicate state waiting to drift. `composeCareerModel` is the one place the
 * pipeline runs; every product consumes its output, so there is no competing
 * source of truth.
 *
 * Pure and deterministic: no fetch, no clock, no persistence. Input is an already
 * source-checked `EvidenceCollection`; output is bounded by that evidence. Trust
 * is never inflated — `decisionGrade ⇔ status==='checked'` flows straight through.
 *
 * Layering: this sits ABOVE every other projector and imports only from them. It
 * adds no new trust math — it orchestrates the existing, audited projectors.
 */
import type { EvidenceCollection } from '../types';
import { projectEvidenceToGraph } from '../projectors/graph';
import { propagateTrust, type TrustProjection } from '../trust/propagate';
import { projectTimeline, type TimelineProjection, type CareerEvent } from '../timeline/timeline';
import {
  defaultReadinessTemplate,
  deriveMobilityOverview,
  detectGaps,
  projectReadiness,
  type MobilityOverview,
  type ReadinessProjection,
  type OpportunityObject,
} from '../mobility/mobility';
import { projectOrganizations, type OrganizationGraph } from '../organizations/organizations';
import {
  projectProfessionalGrowth,
  type ProfessionalGrowthProjection,
  type Milestone,
  type MentorshipRelationship,
} from '../growth/growth';
import { generateIntelligence, type IntelligenceProjection } from '../intelligence/intelligence';
import {
  projectCareerLongitudinal,
  type CareerLongitudinal,
} from './longitudinal';

export const CAREER_MODEL_SCHEMA = 'vitalcv.career.v1' as const;

/** Stable identity header for the career subject. */
export interface CareerIdentity {
  subjectKey: string;
  displayName: string;
  npi: string | null;
}

/** Provenance/versioning header — lets consumers cache and detect change. */
export interface CareerModelMeta {
  /** Schema version of the model contract. */
  schema: typeof CAREER_MODEL_SCHEMA;
  /**
   * Stable content hash over the decision-relevant evidence (id + status +
   * checkedAt). Same evidence ⇒ same hash ⇒ safe to reuse a cached render.
   * Changes the instant any evidence changes. Used as the route ETag (C4).
   */
  contentHash: string;
  decisionGradeEvidence: number;
  totalEvidence: number;
}

/**
 * The canonical Career Model. Every section is a pass-through of an existing,
 * audited projection — composed once, here.
 */
export interface CareerModel {
  schema: typeof CAREER_MODEL_SCHEMA;
  identity: CareerIdentity;
  evidence: EvidenceCollection;
  trust: TrustProjection;
  timeline: TimelineProjection;
  mobility: MobilityOverview;
  readiness: ReadinessProjection;
  organizations: OrganizationGraph;
  growth: ProfessionalGrowthProjection;
  intelligence: IntelligenceProjection;
  longitudinal: CareerLongitudinal;
  meta: CareerModelMeta;
}

export interface ComposeCareerOptions {
  /** Readiness template the consumer's policy applies (defaults to decision-grade). */
  opportunity?: OpportunityObject;
  /** Known mentorship relationships feeding the growth projection. */
  mentorship?: MentorshipRelationship[];
}

/**
 * FNV-1a, 32-bit. Pure JS (no node:crypto — this package is app-agnostic and
 * runs anywhere). Sufficient for a cache-validation ETag, NOT for security.
 *
 * Hashes the FULL collection. The Career Model is a pure function of the
 * collection, so this ETag changes whenever ANY model-affecting input changes —
 * evidence values, provenance, identity, relationships — not merely status or
 * checkedAt. Hashing a narrow subset would let a changed model return a stale
 * 304. Object key order is deterministic from the canonical builder.
 */
function contentHash(collection: EvidenceCollection): string {
  let h = 0x811c9dc5;
  const material = JSON.stringify({
    subjectKey: collection.subjectKey,
    generatedFor: collection.generatedFor,
    objects: collection.objects,
    relationships: collection.relationships,
  });
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Compose the one canonical Career Model. Runs the full projection pipeline a
 * single time over a single resolved collection. This is W1000-C1 + C2: the
 * unified aggregate AND the single orchestration layer.
 */
export function composeCareerModel(
  collection: EvidenceCollection,
  options: ComposeCareerOptions = {},
): CareerModel {
  // ── One pass through the audited pipeline ────────────────────────────────
  const graph = projectEvidenceToGraph(collection);
  const trust = propagateTrust(graph);
  const timeline = projectTimeline(collection, graph, trust);
  const mobility = deriveMobilityOverview(collection, trust);
  const opportunity = options.opportunity ?? defaultReadinessTemplate();
  const readiness = projectReadiness(opportunity, detectGaps(opportunity, collection, trust), trust);
  const organizations = projectOrganizations(collection, graph);
  const growth = projectProfessionalGrowth(collection, trust, timeline, options.mentorship ?? []);
  const intelligence = generateIntelligence(collection, trust, timeline, mobility, organizations);

  // ── C3: longitudinal (decades, immutable milestones, versioned evidence) ──
  const longitudinal = projectCareerLongitudinal(timeline, growth.milestones);

  const meta: CareerModelMeta = {
    schema: CAREER_MODEL_SCHEMA,
    contentHash: contentHash(collection),
    decisionGradeEvidence: trust.overall.decisionGradeEvidence,
    totalEvidence: trust.overall.totalEvidence,
  };

  return {
    schema: CAREER_MODEL_SCHEMA,
    identity: {
      subjectKey: collection.subjectKey,
      displayName: collection.generatedFor.displayName,
      npi: collection.generatedFor.npi,
    },
    evidence: collection,
    trust,
    timeline,
    mobility,
    readiness,
    organizations,
    growth,
    intelligence,
    longitudinal,
    meta,
  };
}

export type { CareerLongitudinal, CareerEvent, Milestone };
