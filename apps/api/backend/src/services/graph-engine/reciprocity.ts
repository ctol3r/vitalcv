import type { PrismaClient } from '@prisma/client';
import { createReciprocalRuleId } from './ids';

export type RelationshipMode = 'ONE_WAY' | 'MIRROR' | 'BACKLINK' | 'MIRROR_ONLY';

export interface ReciprocalRule {
  id: string;
  edgeType: string;
  reverseEdgeType: string;
  relationshipMode: RelationshipMode;
  directed: boolean;
  reciprocal: boolean;
  autoCreate: boolean;
  explanation: string;
  metadata: Record<string, unknown>;
}

export const DEFAULT_RECIPROCAL_RULES: ReciprocalRule[] = [
  {
    id: createReciprocalRuleId('explicit_link'),
    edgeType: 'explicit_link',
    reverseEdgeType: 'backlink',
    relationshipMode: 'BACKLINK',
    directed: true,
    reciprocal: true,
    autoCreate: true,
    explanation: 'Explicit links create durable reverse backlinks.',
    metadata: {},
  },
  {
    id: createReciprocalRuleId('backlink'),
    edgeType: 'backlink',
    reverseEdgeType: 'explicit_link',
    relationshipMode: 'MIRROR_ONLY',
    directed: true,
    reciprocal: true,
    autoCreate: false,
    explanation: 'Backlinks are reverse mirrors of explicit links.',
    metadata: {},
  },
  {
    id: createReciprocalRuleId('ai_accepted_link'),
    edgeType: 'ai_accepted_link',
    reverseEdgeType: 'ai_accepted_link',
    relationshipMode: 'MIRROR',
    directed: false,
    reciprocal: true,
    autoCreate: true,
    explanation: 'Accepted AI links create durable reverse mirror edges.',
    metadata: {},
  },
  {
    id: createReciprocalRuleId('semantic_similarity'),
    edgeType: 'semantic_similarity',
    reverseEdgeType: 'semantic_similarity',
    relationshipMode: 'MIRROR',
    directed: false,
    reciprocal: true,
    autoCreate: true,
    explanation: 'Semantic similarity is symmetric.',
    metadata: {},
  },
  {
    id: createReciprocalRuleId('related_to'),
    edgeType: 'related_to',
    reverseEdgeType: 'related_to',
    relationshipMode: 'MIRROR',
    directed: false,
    reciprocal: true,
    autoCreate: true,
    explanation: 'Related-to edges are symmetric.',
    metadata: {},
  },
  {
    id: createReciprocalRuleId('same_as'),
    edgeType: 'same_as',
    reverseEdgeType: 'same_as',
    relationshipMode: 'MIRROR',
    directed: false,
    reciprocal: true,
    autoCreate: true,
    explanation: 'Identity equivalence is symmetric.',
    metadata: {},
  },
  {
    id: createReciprocalRuleId('verified_by'),
    edgeType: 'verified_by',
    reverseEdgeType: 'verified_by',
    relationshipMode: 'ONE_WAY',
    directed: true,
    reciprocal: false,
    autoCreate: false,
    explanation: 'Verification provenance is directional.',
    metadata: {},
  },
  {
    id: createReciprocalRuleId('accepted_by'),
    edgeType: 'accepted_by',
    reverseEdgeType: 'accepted_by',
    relationshipMode: 'ONE_WAY',
    directed: true,
    reciprocal: false,
    autoCreate: false,
    explanation: 'Acceptance edges preserve direction.',
    metadata: {},
  },
];

export async function ensureReciprocalEdgeRules(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    DEFAULT_RECIPROCAL_RULES.map((rule) =>
      prisma.reciprocalEdgeRule.upsert({
        where: { edgeType: rule.edgeType },
        update: {
          reverseEdgeType: rule.reverseEdgeType,
          relationshipMode: rule.relationshipMode,
          directed: rule.directed,
          reciprocal: rule.reciprocal,
          autoCreate: rule.autoCreate,
          explanation: rule.explanation,
          metadata: JSON.parse(JSON.stringify(rule.metadata)),
        },
        create: {
          id: rule.id,
          edgeType: rule.edgeType,
          reverseEdgeType: rule.reverseEdgeType,
          relationshipMode: rule.relationshipMode,
          directed: rule.directed,
          reciprocal: rule.reciprocal,
          autoCreate: rule.autoCreate,
          explanation: rule.explanation,
          metadata: JSON.parse(JSON.stringify(rule.metadata)),
        },
      }),
    ),
  );
}

export async function loadReciprocalRuleMap(prisma: PrismaClient): Promise<Map<string, ReciprocalRule>> {
  const persisted = await prisma.reciprocalEdgeRule.findMany();
  const rules = persisted.length > 0
    ? persisted.map((rule) => ({
        id: rule.id,
        edgeType: rule.edgeType,
        reverseEdgeType: rule.reverseEdgeType,
        relationshipMode: rule.relationshipMode as RelationshipMode,
        directed: rule.directed,
        reciprocal: rule.reciprocal,
        autoCreate: rule.autoCreate,
        explanation: rule.explanation ?? '',
        metadata: (rule.metadata ?? {}) as Record<string, unknown>,
      }))
    : DEFAULT_RECIPROCAL_RULES;

  return new Map(rules.map((rule) => [rule.edgeType, rule]));
}
