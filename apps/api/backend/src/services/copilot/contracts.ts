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

export const copilotQueryRequestSchema = z.object({
  query: z.string().trim().min(3).max(500),
  limit: z.number().int().min(1).max(20).optional().default(20),
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

export const copilotQueryResponseSchema = z.object({
  parsedQuery: copilotParsedQuerySchema,
  results: z.array(copilotResultSchema),
  explanations: z.array(copilotExplanationSchema),
  graphInsights: z.array(copilotGraphInsightSchema),
});

export type CopilotQueryRequest = z.infer<typeof copilotQueryRequestSchema>;
export type CopilotQueryResponseContract = z.infer<typeof copilotQueryResponseSchema>;
export type CopilotParsedQueryContract = z.infer<typeof copilotParsedQuerySchema>;
export type CopilotResultContract = z.infer<typeof copilotResultSchema>;
export type CopilotExplanationContract = z.infer<typeof copilotExplanationSchema>;
export type CopilotGraphInsightContract = z.infer<typeof copilotGraphInsightSchema>;
export type CopilotSearchEngineContract = z.infer<typeof searchEngineSchema>;
