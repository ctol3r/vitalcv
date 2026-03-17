import { z } from 'zod';

const graphTraversalSchema = z.enum([
  'NEIGHBORS',
  'COLLABORATORS',
  'INSTITUTION_CONNECTIONS',
  'TRIAL_INVESTIGATORS',
  'PUBLICATION_NETWORKS',
]);

const searchEngineSchema = z.enum(['STRUCTURED', 'SEMANTIC', 'GRAPH', 'TRUST']);
const entityTypeSchema = z.enum(['CLINICIAN', 'ORGANIZATION', 'OPPORTUNITY', 'PROGRAM', 'DOCUMENT']);
const copilotDocumentModeSchema = z.enum(['summary', 'plan', 'check', 'compare', 'network', 'history']);
const copilotDocumentSectionKeySchema = z.enum([
  'summary',
  'evidence',
  'signals',
  'network_context',
  'recommended_action',
  'follow_up_questions',
]);
const requiredCopilotDocumentSectionKeys = [...copilotDocumentSectionKeySchema.options];
const copilotAvailabilitySchema = z.enum(['ready', 'limited', 'unavailable']);
const copilotEntityKindSchema = z.enum([
  'provider',
  'finding',
  'storyline',
  'institution',
  'company',
  'trial',
  'publication',
  'graph_node',
  'source',
]);
const copilotCommandNameSchema = z.enum([
  'investigate',
  'summarize',
  'plan',
  'check',
  'compare',
  'network',
  'history',
]);
const copilotGraphActionTypeSchema = z.enum([
  'focus_node',
  'highlight_neighborhood',
  'navigate_provider',
]);

const workbenchEvidenceSchema = z.object({
  source: z.string(),
  claim: z.string(),
  confidence: z.number(),
  observedAt: z.string().nullable().optional(),
  field: z.string().optional(),
  provenanceChain: z.array(z.string()).optional(),
  qualityRating: z.enum(['STRONG', 'ADEQUATE', 'WEAK', 'MISSING']).optional(),
  corroborationCount: z.number().int().nonnegative().optional(),
});

const workbenchProviderContextSchema = z.object({
  npi: z.string(),
  label: z.string().nullable(),
  specialty: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  trustScore: z.number(),
  trustBand: z.string(),
  trustConfidence: z.number().optional(),
  activeFindings: z.number().int().nonnegative().optional(),
});

const workbenchFindingContextSchema = z.object({
  id: z.string(),
  findingType: z.string(),
  title: z.string(),
  severity: z.string(),
  status: z.string(),
  summary: z.string(),
  explanation: z.string(),
  confidence: z.number(),
  priorityScore: z.number(),
  evidence: z.array(workbenchEvidenceSchema).optional().default([]),
  storylineId: z.string().nullable().optional(),
  storylineTitle: z.string().nullable().optional(),
  npis: z.array(z.string()).optional().default([]),
});

const workbenchStorylineContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  storylineType: z.string(),
  severity: z.string(),
  status: z.string(),
  narrative: z.string().optional(),
  whyItMatters: z.string(),
  findingCount: z.number().int().nonnegative().optional(),
  entityCount: z.number().int().nonnegative().optional(),
  confidence: z.number(),
  progressionScore: z.number().optional(),
  recommendedActions: z.array(z.string()).optional().default([]),
  lastActivityAt: z.string().optional(),
  evidence: z.array(workbenchEvidenceSchema).optional().default([]),
});

const copilotRecentFindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  severity: z.string(),
  priorityScore: z.number().optional(),
  href: z.string().optional(),
});

const copilotEvidenceSummaryItemSchema = z.object({
  label: z.string(),
  detail: z.string(),
  source: z.string(),
  observedAt: z.string().nullable().optional(),
});

const copilotRiskSummarySchema = z.object({
  trustScore: z.number().optional(),
  trustBand: z.string().optional(),
  trustConfidence: z.number().optional(),
  summary: z.string().optional(),
});

const copilotGraphContextSchema = z.object({
  focusNodeId: z.string().nullable().optional(),
  selectedNodeId: z.string().nullable().optional(),
  neighborNodeIds: z.array(z.string()).optional().default([]),
  neighborEdgeIds: z.array(z.string()).optional().default([]),
});

export const copilotQueryRequestSchema = z.object({
  query: z.string().trim().min(3).max(500),
  limit: z.number().int().min(1).max(20).optional().default(20),
  sessionId: z.string().trim().min(1).max(120).optional(),
  providerId: z.string().trim().min(1).max(120).optional(),
  findingId: z.string().trim().min(1).max(120).optional(),
  storylineId: z.string().trim().min(1).max(120).optional(),
  context: z.object({
    scope: z.enum(['provider', 'finding', 'storyline', 'graph', 'global']),
    provider: workbenchProviderContextSchema.optional(),
    finding: workbenchFindingContextSchema.optional(),
    storyline: workbenchStorylineContextSchema.optional(),
    graph: copilotGraphContextSchema.optional(),
    recentFindings: z.array(copilotRecentFindingSchema).optional().default([]),
    evidenceSummary: z.array(copilotEvidenceSummaryItemSchema).optional().default([]),
    riskSummary: copilotRiskSummarySchema.optional(),
  }).optional(),
  command: z.object({
    name: copilotCommandNameSchema,
    argument: z.string().trim().min(1).max(240).optional(),
    raw: z.string().trim().min(1).max(300).optional(),
  }).optional(),
});

export const copilotResultScoresSchema = z.object({
  relevance: z.number(),
  trustScore: z.number(),
  freshness: z.number(),
  sourceCoverage: z.number(),
  total: z.number(),
});

export const copilotParsedQuerySchema = z.object({
  rawQuery: z.string(),
  normalizedQuery: z.string(),
  intent: z.enum([
    'DISCOVERY',
    'EXPLAINABILITY',
    'GRAPH_EXPLORATION',
    'RESEARCH_DISCOVERY',
    'DUE_DILIGENCE',
    'GENERAL',
  ]),
  keywords: z.array(z.string()),
  structuredFilters: z.object({
    specialties: z.array(z.string()),
    states: z.array(z.string()),
    institutions: z.array(z.string()),
    licenseStatuses: z.array(z.string()),
    trustScore: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
    boardCertified: z.boolean().optional(),
    researchTopics: z.array(z.string()),
    payments: z.enum(['HAS_PAYMENTS', 'LOW_PAYMENTS', 'NO_PAYMENTS']).optional(),
    affiliations: z.array(z.string()),
  }),
  semanticTopics: z.array(z.string()),
  graphTraversal: z.array(graphTraversalSchema),
  rankingWeights: z.object({
    relevance: z.number(),
    trustScore: z.number(),
    freshness: z.number(),
    sourceCoverage: z.number(),
  }),
});

export const copilotMatchSchema = z.object({
  field: z.enum([
    'specialty',
    'state',
    'institution',
    'licenseStatus',
    'trustScore',
    'boardCertification',
    'researchTopic',
    'payments',
    'affiliation',
    'keyword',
    'graph',
  ]),
  value: z.union([z.string(), z.number(), z.boolean()]),
  reason: z.string(),
});

export const copilotResultSchema = z.object({
  id: z.string(),
  rank: z.number().int().positive(),
  type: entityTypeSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  summary: z.string(),
  specialty: z.string().optional(),
  state: z.string().optional(),
  institution: z.string().optional(),
  licenseStatus: z.string().optional(),
  boardCertified: z.boolean().optional(),
  trustScore: z.number().optional(),
  trustBand: z.string().optional(),
  scores: copilotResultScoresSchema,
  sourceCoverage: z.array(z.string()),
});

export const copilotExplanationSchema = z.object({
  resultId: z.string(),
  title: z.string(),
  summary: z.string(),
  because: z.array(z.string()),
  matchedFilters: z.array(copilotMatchSchema),
  verifiedSources: z.array(z.string()),
  scoring: copilotResultScoresSchema,
});

export const copilotGraphInsightSchema = z.object({
  resultId: z.string().optional(),
  type: z.enum([
    'NEIGHBOR',
    'COLLABORATOR',
    'INSTITUTION_CONNECTION',
    'TRIAL_INVESTIGATOR',
    'PUBLICATION_NETWORK',
    'SOURCE_COVERAGE',
  ]),
  summary: z.string(),
  path: z.array(z.string()),
  depth: z.number().int().nonnegative(),
});

export const copilotDocumentEntitySchema = z.object({
  id: z.string(),
  kind: copilotEntityKindSchema,
  label: z.string(),
  providerNpi: z.string().optional(),
  findingId: z.string().optional(),
  storylineId: z.string().optional(),
  nodeId: z.string().optional(),
});

export const copilotDocumentCitationSchema = z.object({
  id: z.string(),
  label: z.string(),
  source: z.string().optional(),
  findingId: z.string().optional(),
  evidenceIndex: z.number().int().nonnegative().optional(),
});

export const copilotDocumentGraphActionSchema = z.object({
  type: copilotGraphActionTypeSchema,
  label: z.string(),
  nodeId: z.string().optional(),
  providerNpi: z.string().optional(),
});

export const copilotDocumentSectionItemSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  body: z.string(),
  availability: copilotAvailabilitySchema.optional(),
  entities: z.array(copilotDocumentEntitySchema).optional(),
  citations: z.array(copilotDocumentCitationSchema).optional(),
  graphAction: copilotDocumentGraphActionSchema.optional(),
});

export const copilotDocumentSectionSchema = z.object({
  key: copilotDocumentSectionKeySchema,
  title: z.string(),
  availability: copilotAvailabilitySchema,
  summary: z.string().optional(),
  items: z.array(copilotDocumentSectionItemSchema),
});

export const copilotDocumentSchema = z.object({
  mode: copilotDocumentModeSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  generatedAt: z.string().optional(),
  suggestions: z.array(z.string()).optional().default([]),
  sections: z.array(copilotDocumentSectionSchema).superRefine((sections, context) => {
    const sectionCounts = new Map<string, number>();

    for (const section of sections) {
      sectionCounts.set(section.key, (sectionCounts.get(section.key) ?? 0) + 1);
    }

    for (const key of requiredCopilotDocumentSectionKeys) {
      const count = sectionCounts.get(key) ?? 0;
      if (count === 1) {
        continue;
      }

      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: count === 0
          ? `document section ${key} is required`
          : `document section ${key} must appear exactly once`,
        path: ['sections'],
      });
    }
  }),
});

export const copilotQueryOkResponseSchema = z.object({
  status: z.literal('ok'),
  answer: z.string(),
  sources: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  parsedQuery: copilotParsedQuerySchema,
  results: z.array(copilotResultSchema),
  explanations: z.array(copilotExplanationSchema),
  graphInsights: z.array(copilotGraphInsightSchema),
  document: copilotDocumentSchema,
});

export const copilotQueryLimitedResponseSchema = z.object({
  status: z.literal('limited'),
  title: z.string(),
  message: z.string(),
  suggestions: z.array(z.string()),
  answer: z.string(),
  sources: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  parsedQuery: copilotParsedQuerySchema.optional(),
  results: z.array(copilotResultSchema).default([]),
  explanations: z.array(copilotExplanationSchema).default([]),
  graphInsights: z.array(copilotGraphInsightSchema).default([]),
  document: copilotDocumentSchema,
});

export const copilotQueryResponseSchema = z.discriminatedUnion('status', [
  copilotQueryOkResponseSchema,
  copilotQueryLimitedResponseSchema,
]);

export type CopilotQueryRequest = z.infer<typeof copilotQueryRequestSchema>;
export type CopilotParsedQueryContract = z.infer<typeof copilotParsedQuerySchema>;
export type CopilotResultContract = z.infer<typeof copilotResultSchema>;
export type CopilotExplanationContract = z.infer<typeof copilotExplanationSchema>;
export type CopilotGraphInsightContract = z.infer<typeof copilotGraphInsightSchema>;
export type CopilotSearchEngineContract = z.infer<typeof searchEngineSchema>;
export type CopilotDocumentModeContract = string;
export type CopilotDocumentSectionKeyContract = string;
export type CopilotAvailabilityContract = string;
export type CopilotDocumentEntityContract = {
  id: string;
  kind: string;
  label: string;
  providerNpi?: string;
  findingId?: string;
  storylineId?: string;
  nodeId?: string;
};
export type CopilotDocumentCitationContract = {
  id: string;
  label: string;
  source?: string;
  findingId?: string;
  evidenceIndex?: number;
};
export type CopilotDocumentGraphActionContract = {
  type: string;
  label: string;
  nodeId?: string;
  providerNpi?: string;
};
export type CopilotDocumentSectionItemContract = {
  id: string;
  title?: string;
  body: string;
  availability?: CopilotAvailabilityContract;
  entities?: CopilotDocumentEntityContract[];
  citations?: CopilotDocumentCitationContract[];
  graphAction?: CopilotDocumentGraphActionContract;
};
export type CopilotDocumentSectionContract = {
  key: CopilotDocumentSectionKeyContract;
  title: string;
  availability: CopilotAvailabilityContract;
  summary?: string;
  items: CopilotDocumentSectionItemContract[];
};
export type CopilotDocumentContract = {
  mode: CopilotDocumentModeContract;
  title: string;
  subtitle?: string;
  generatedAt?: string;
  suggestions?: string[];
  sections: CopilotDocumentSectionContract[];
};
export type CopilotQueryOkResponseContract = {
  status: 'ok';
  answer: string;
  sources: string[];
  confidence: number;
  parsedQuery: CopilotParsedQueryContract;
  results: CopilotResultContract[];
  explanations: CopilotExplanationContract[];
  graphInsights: CopilotGraphInsightContract[];
  document: CopilotDocumentContract;
};
export type CopilotQueryLimitedResponseContract = {
  status: 'limited';
  title: string;
  message: string;
  suggestions: string[];
  answer: string;
  sources: string[];
  confidence: number;
  parsedQuery?: CopilotParsedQueryContract;
  results: CopilotResultContract[];
  explanations: CopilotExplanationContract[];
  graphInsights: CopilotGraphInsightContract[];
  document: CopilotDocumentContract;
};
export type CopilotQueryResponseContract =
  | CopilotQueryOkResponseContract
  | CopilotQueryLimitedResponseContract;
export type CopilotCommandContract = z.infer<typeof copilotQueryRequestSchema>['command'];
export type CopilotQueryContextContract = z.infer<typeof copilotQueryRequestSchema>['context'];
