/**
 * Organization graph (Wave 265).
 *
 * Pure projection of the organizations that back a clinician's evidence:
 * training institutions, credential issuers, licensing boards, verification
 * authorities, employers. Collapses the evidence→source path into a direct
 * clinician↔organization relationship typed by the backing evidence class.
 *
 * Honesty carries through: an organization's `trustContribution` is the mean of
 * the trust scores of the evidence it backs (bounded, gated = 0) — it never
 * inflates, and an org backing only gated evidence contributes 0.
 */

import type { EvidenceClass, EvidenceCollection } from '../types';
import type { GraphProjection, GraphRelationshipType } from '../projectors/graph';

export type OrganizationKind =
  | 'verification_authority'
  | 'licensing_board'
  | 'credential_issuer'
  | 'training_institution'
  | 'employer'
  | 'other';

export interface OrganizationNode {
  id: string;
  sourceId: string;
  label: string;
  kind: OrganizationKind;
  evidenceClasses: EvidenceClass[];
  evidenceCount: number;
  decisionGradeCount: number;
  /** Mean trust score of the evidence this org backs; null if none scored. */
  trustContribution: number | null;
}

export interface ClinicianOrganizationRelationship {
  from: string;
  to: string;
  type: GraphRelationshipType;
  evidenceIds: string[];
  decisionGrade: boolean;
}

export interface OrganizationGraph {
  subjectKey: string;
  organizations: OrganizationNode[];
  relationships: ClinicianOrganizationRelationship[];
  stats: { organizationCount: number; decisionGradeOrganizations: number };
}

// Most-specific career organization wins when one source backs several classes.
const KIND_FOR_CLASS: Record<EvidenceClass, OrganizationKind> = {
  employment: 'employer',
  recognition: 'employer',
  acceptance: 'employer',
  start: 'employer',
  privilege: 'employer',
  peer_review: 'employer',
  training: 'training_institution',
  board_cert: 'credential_issuer',
  licensure: 'licensing_board',
  registration: 'licensing_board',
  identity: 'verification_authority',
  exclusion: 'verification_authority',
  enrollment: 'verification_authority',
  research: 'other',
  publication: 'other',
};

const KIND_PRIORITY: OrganizationKind[] = [
  'employer',
  'training_institution',
  'credential_issuer',
  'licensing_board',
  'verification_authority',
  'other',
];

function classifyOrgKind(classes: readonly EvidenceClass[]): OrganizationKind {
  const kinds = new Set(classes.map((c) => KIND_FOR_CLASS[c]));
  return KIND_PRIORITY.find((k) => kinds.has(k)) ?? 'other';
}

const RELATIONSHIP_FOR_KIND: Record<OrganizationKind, GraphRelationshipType> = {
  employer: 'EMPLOYED_BY',
  training_institution: 'TRAINED_AT',
  credential_issuer: 'CERTIFIED_BY',
  licensing_board: 'VERIFIED_BY',
  verification_authority: 'VERIFIED_BY',
  other: 'VERIFIED_BY',
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10000) / 10000;
}

export function projectOrganizations(
  collection: EvidenceCollection,
  graph: GraphProjection,
): OrganizationGraph {
  const trustById = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.type === 'evidence' && node.trustScore !== null) trustById.set(node.id, node.trustScore);
  }

  const groups = new Map<string, {
    sourceId: string; label: string; evidenceIds: string[];
    classes: Set<EvidenceClass>; decisionGradeCount: number; scores: number[];
  }>();

  for (const obj of collection.objects) {
    const key = obj.source.sourceId;
    const g = groups.get(key) ?? { sourceId: key, label: obj.source.sourceLabel || key, evidenceIds: [], classes: new Set(), decisionGradeCount: 0, scores: [] };
    g.evidenceIds.push(obj.evidenceId);
    g.classes.add(obj.evidenceClass);
    if (obj.decisionGrade) g.decisionGradeCount += 1;
    const score = trustById.get(obj.evidenceId);
    if (score !== undefined) g.scores.push(score);
    groups.set(key, g);
  }

  const subjectId = `subject:${collection.subjectKey}`;
  const organizations: OrganizationNode[] = [];
  const relationships: ClinicianOrganizationRelationship[] = [];

  for (const g of groups.values()) {
    const classes = [...g.classes].sort();
    const kind = classifyOrgKind(classes);
    const orgId = `org:${g.sourceId}`;
    organizations.push({
      id: orgId,
      sourceId: g.sourceId,
      label: g.label,
      kind,
      evidenceClasses: classes,
      evidenceCount: g.evidenceIds.length,
      decisionGradeCount: g.decisionGradeCount,
      trustContribution: mean(g.scores),
    });
    relationships.push({
      from: subjectId,
      to: orgId,
      type: RELATIONSHIP_FOR_KIND[kind],
      evidenceIds: g.evidenceIds,
      decisionGrade: g.decisionGradeCount > 0,
    });
  }

  organizations.sort((a, b) => a.id.localeCompare(b.id));
  relationships.sort((a, b) => a.to.localeCompare(b.to));

  return {
    subjectKey: collection.subjectKey,
    organizations,
    relationships,
    stats: {
      organizationCount: organizations.length,
      decisionGradeOrganizations: organizations.filter((o) => o.decisionGradeCount > 0).length,
    },
  };
}
