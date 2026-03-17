import {
  buildEdgeCaseEndpoints,
  scanEndpointEdgeCases,
  testApiContracts,
  validateSchemaConsistency,
  checkGraphIntegrity,
  validateCopilotStructuredResponse,
} from '../../../../../../core/qa';
import {
  recordApiLatencySample,
  recordDatabaseQuerySample,
  recordGraphRenderSample,
  recordCopilotResponseSample,
  evaluatePerformanceWatchers,
  resetPerformanceWatchers,
} from '../performanceWatchers';
import { copilotQueryResponseSchema } from '../../services/copilot/contracts';

describe('qa modules', () => {
  afterEach(() => {
    resetPerformanceWatchers();
  });

  it('scans runtime endpoints for server errors and malformed payloads', async () => {
    const endpoints = buildEdgeCaseEndpoints([
      { method: 'GET', path: '/api/system/status' },
      { method: 'POST', path: '/api/copilot/query' },
    ]);

    const result = await scanEndpointEdgeCases(endpoints, async (endpoint) => {
      if (endpoint.path === '/api/system/status') {
        return {
          statusCode: 500,
          contentType: 'application/json',
          latencyMs: 10,
          body: { error: 'boom' },
        };
      }

      return {
        statusCode: 200,
        contentType: 'application/json',
        latencyMs: 12,
        body: null,
      };
    });

    expect(result.scannedCount).toBe(2);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['endpoint_server_error', 'endpoint_malformed_payload']),
    );
  });

  it('detects contract and schema drift', () => {
    const runtimeEndpoints = [{ method: 'GET', path: '/health' }];
    const documentedEndpoints = [{ method: 'GET', path: '/health' }, { method: 'POST', path: '/recognitions' }];
    const contract = testApiContracts(runtimeEndpoints, documentedEndpoints, 'test-spec');
    expect(contract.findings).toHaveLength(1);

    const schema = validateSchemaConsistency(
      'left',
      {
        paths: {
          '/health': {
            get: {
              responses: { 200: { description: 'ok' } },
            },
          },
        },
      },
      'right',
      {
        paths: {
          '/health': {
            get: {
              responses: { 503: { description: 'down' } },
            },
          },
        },
      },
    );

    expect(schema.findings.map((finding) => finding.code)).toContain('schema_signature_mismatch');
  });

  it('detects graph integrity problems', () => {
    const result = checkGraphIntegrity(
      [
        { id: 'node-1', group: 'clinician' },
        { id: 'node-2', group: 'decision' },
      ],
      [
        { source: 'node-1', target: 'missing-node', label: 'depends_on' },
        { source: 'node-2', target: 'node-2', label: 'self' },
      ],
    );

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['graph_broken_edge_reference', 'graph_self_loop']),
    );
  });

  it('rejects structured copilot responses with dangling references', () => {
    const validBase = {
      status: 'ok' as const,
      answer: 'Example answer',
      sources: ['NPPES'],
      confidence: 0.85,
      parsedQuery: {
        rawQuery: 'cardiologists in texas',
        normalizedQuery: 'cardiologists in texas',
        intent: 'DUE_DILIGENCE' as const,
        keywords: ['cardiologists', 'texas'],
        structuredFilters: {
          specialties: ['Cardiology'],
          states: ['TX'],
          institutions: [],
          licenseStatuses: [],
          trustScore: { min: 80 },
          boardCertified: undefined,
          researchTopics: [],
          payments: undefined,
          affiliations: [],
        },
        semanticTopics: ['Cardiology', 'TX'],
        graphTraversal: [],
        rankingWeights: {
          relevance: 0.25,
          trustScore: 0.25,
          freshness: 0.25,
          sourceCoverage: 0.25,
        },
      },
      results: [
        {
          id: 'clinician:1',
          rank: 1,
          type: 'CLINICIAN' as const,
          title: 'Dr Example',
          summary: 'Example summary',
          scores: {
            relevance: 0.9,
            trustScore: 0.9,
            freshness: 0.8,
            sourceCoverage: 0.7,
            total: 0.85,
          },
          sourceCoverage: ['NPPES'],
        },
      ],
      explanations: [
        {
          resultId: 'missing',
          title: 'Missing',
          summary: 'Mismatch',
          because: ['reason'],
          matchedFilters: [],
          verifiedSources: ['NPPES'],
          scoring: {
            relevance: 0.9,
            trustScore: 0.9,
            freshness: 0.8,
            sourceCoverage: 0.7,
            total: 0.85,
          },
        },
      ],
      graphInsights: [],
      document: {
        mode: 'summary' as const,
        title: 'Copilot response',
        subtitle: 'cardiologists in texas',
        generatedAt: '2026-03-15T12:00:00.000Z',
        suggestions: ['What should I do next?'],
        sections: [
          {
            key: 'summary' as const,
            title: 'Summary',
            availability: 'ready' as const,
            items: [{ id: 'summary-1', body: 'Summary body.' }],
          },
          {
            key: 'evidence' as const,
            title: 'Evidence',
            availability: 'ready' as const,
            items: [{ id: 'evidence-1', body: 'Evidence body.' }],
          },
          {
            key: 'signals' as const,
            title: 'Signals',
            availability: 'ready' as const,
            items: [{ id: 'signals-1', body: 'Signals body.' }],
          },
          {
            key: 'network_context' as const,
            title: 'Network Context',
            availability: 'ready' as const,
            items: [{ id: 'network-1', body: 'Network body.' }],
          },
          {
            key: 'recommended_action' as const,
            title: 'Recommended Action',
            availability: 'ready' as const,
            items: [{ id: 'action-1', body: 'Action body.' }],
          },
          {
            key: 'follow_up_questions' as const,
            title: 'Follow-up Questions',
            availability: 'ready' as const,
            items: [{ id: 'followup-1', body: 'Follow-up body.' }],
          },
        ],
      },
    };

    const validation = validateCopilotStructuredResponse(validBase, {
      safeParse: (input) => copilotQueryResponseSchema.safeParse(input),
    });

    expect(validation.valid).toBe(false);
    expect(validation.findings.map((finding) => finding.code)).toContain('copilot_explanation_missing_result');
  });

  it('flags performance regressions from recorded samples', () => {
    for (let index = 0; index < 6; index += 1) {
      recordApiLatencySample({
        routeKey: 'GET /api/system/status',
        latencyMs: 200,
        statusCode: 200,
      });
      recordDatabaseQuerySample({
        model: 'VerificationArtifact',
        action: 'findMany',
        durationMs: 90,
      });
      recordCopilotResponseSample({
        latencyMs: 300,
        resultCount: 2,
      });
    }

    evaluatePerformanceWatchers();

    for (let index = 0; index < 12; index += 1) {
      recordApiLatencySample({
        routeKey: 'GET /api/system/status',
        latencyMs: 1_050,
        statusCode: 200,
      });
      recordDatabaseQuerySample({
        model: 'VerificationArtifact',
        action: 'findMany',
        durationMs: 450,
      });
    }

    for (let index = 0; index < 4; index += 1) {
      recordGraphRenderSample({
        operation: 'aggregateGraph',
        latencyMs: 650,
      });
      recordCopilotResponseSample({
        latencyMs: 1_300,
        resultCount: 2,
      });
    }

    const result = evaluatePerformanceWatchers({
      graphTelemetry: {
        nodeCount: 500,
        edgeCount: 2_000,
        estimatedRenderMs: 320,
        density: 4,
        clusteringRecommended: true,
        recommendedNodeBudget: 200,
      },
    });

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'slow_api_route',
        'slow_query_family',
        'graph_render_latency',
        'graph_traversal_inefficiency',
        'copilot_latency_regression',
      ]),
    );
  });
});
