import express from 'express';
import request from 'supertest';

jest.mock('../../services/investigation/investigationWorkbenchService', () => ({
  buildEvidenceViewerPayload: jest.fn(),
  listInvestigationFeed: jest.fn(),
}));

jest.mock('../../services/investigation/investigatorLearningService', () => ({
  buildLearningCalibrationReport: jest.fn(),
  recordInvestigatorLearningFeedback: jest.fn(),
}));

import {
  buildEvidenceViewerPayload,
  listInvestigationFeed,
} from '../../services/investigation/investigationWorkbenchService';
import {
  buildLearningCalibrationReport,
  recordInvestigatorLearningFeedback,
} from '../../services/investigation/investigatorLearningService';
import { registerInvestigationWorkbenchRoutes } from '../investigationWorkbench';

const buildEvidenceViewerPayloadMock = buildEvidenceViewerPayload as jest.MockedFunction<typeof buildEvidenceViewerPayload>;
const listInvestigationFeedMock = listInvestigationFeed as jest.MockedFunction<typeof listInvestigationFeed>;
const buildLearningCalibrationReportMock = buildLearningCalibrationReport as jest.MockedFunction<typeof buildLearningCalibrationReport>;
const recordInvestigatorLearningFeedbackMock = recordInvestigatorLearningFeedback as jest.MockedFunction<typeof recordInvestigatorLearningFeedback>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerInvestigationWorkbenchRoutes(app);
  return app;
}

describe('investigation workbench routes', () => {
  beforeEach(() => {
    buildEvidenceViewerPayloadMock.mockReset();
    listInvestigationFeedMock.mockReset();
    buildLearningCalibrationReportMock.mockReset();
    recordInvestigatorLearningFeedbackMock.mockReset();
  });

  it('returns the investigation feed payload', async () => {
    listInvestigationFeedMock.mockResolvedValue({
      generatedAt: '2026-03-15T12:00:00.000Z',
      total: 1,
      items: [{
        id: 'feed_1',
        type: 'finding',
        headline: 'Finding headline',
        summary: 'Finding summary',
        entityRefs: [],
        confidence: {
          score: 0.8,
          level: 'high',
          label: '80% confidence',
          insufficientSignal: false,
          reasoning: [],
        },
        priority: 'high',
        impact: 'medium',
        linkedEvidenceRefs: [],
        recommendedActionRefs: [],
        createdAt: '2026-03-15T12:00:00.000Z',
        updatedAt: '2026-03-15T12:00:00.000Z',
        signal: null,
        metadata: {},
        rankingInputs: {
          analystRelevance: 1,
          severity: 0.8,
          recency: 1,
          novelty: 0.7,
          actionUrgency: 0.9,
          total: 0.88,
        },
      }],
    } as Awaited<ReturnType<typeof listInvestigationFeed>>);

    const response = await request(buildApp())
      .get('/api/investigations/feed?entityType=provider&entityId=1234567890&limit=5')
      .expect(200);

    expect(listInvestigationFeedMock).toHaveBeenCalledWith({
      entityType: 'provider',
      entityId: '1234567890',
      limit: 5,
    });
    expect(response.body.schema).toBe('https://vitalcv.com/investigations/feed/v1');
    expect(response.body.total).toBe(1);
  });

  it('returns evidence, calibration, and feedback payloads', async () => {
    buildEvidenceViewerPayloadMock.mockResolvedValue({
      evidenceId: 'ev_1',
      evidenceType: 'claim_record',
      provenance: 'NPPES',
      source: 'NPPES',
      retrievalMethod: 'claim_record',
      retrievalTime: '2026-03-15T12:00:00.000Z',
      transformations: [],
      snippet: 'Observed practice location change.',
      url: null,
      recordType: 'claim_record',
      recordId: 'claim_1',
      relatedFindings: [],
      metadata: {},
    } as NonNullable<Awaited<ReturnType<typeof buildEvidenceViewerPayload>>>);
    buildLearningCalibrationReportMock.mockResolvedValue({
      generatedAt: '2026-03-15T12:00:00.000Z',
      totals: {
        reviewed: 2,
        actionable: 1,
        falsePositive: 1,
        inconclusive: 0,
        manualDiscoveryGapCount: 0,
      },
      byInvestigator: [],
      byFindingType: [],
      rootCauseCounts: {},
    } as Awaited<ReturnType<typeof buildLearningCalibrationReport>>);
    recordInvestigatorLearningFeedbackMock.mockResolvedValue({
      recordedAt: '2026-03-15T12:00:00.000Z',
      finding: {
        findingId: 'finding_1',
        investigatorId: 'workforce_shift',
        findingType: 'workforce_shift',
        scope: 'provider',
        severity: 'medium',
        title: 'Movement detected',
        summary: 'Movement summary',
        entityIds: ['1234567890'],
        entities: [],
        supportingEvidence: [],
        confidence: 0.79,
        explanation: 'Movement explanation',
        status: 'resolved',
        createdAt: '2026-03-15T12:00:00.000Z',
        updatedAt: '2026-03-15T12:00:00.000Z',
        firstSeenAt: '2026-03-15T12:00:00.000Z',
        lastSeenAt: '2026-03-15T12:00:00.000Z',
        occurrenceCount: 1,
        priorityScore: 0.79,
        scoreSignals: {
          confidence: 0.79,
          trustImpact: 0.36,
          freshness: 1,
          novelty: 0.9,
          entityImportance: 0.5,
          graphCentrality: 0.4,
        },
        rankBreakdown: {
          severity: 0.4,
          confidence: 0.79,
          trustImpact: 0.36,
          freshness: 1,
          novelty: 0.9,
          entityImportance: 0.5,
          graphCentrality: 0.4,
          total: 0.67,
          weights: {
            severity: 0.2,
            confidence: 0.2,
            trustImpact: 0.15,
            freshness: 0.15,
            novelty: 0.1,
            entityImportance: 0.1,
            graphCentrality: 0.1,
          },
        },
        audienceRoles: ['operations'],
        metadata: {},
        dedupeKey: 'workforce_shift:1234567890:CA:Clinic',
        storylineKey: 'workforce_shift:1234567890',
        statusEvents: [],
      },
      resolution: 'true_positive_actionable',
      confidenceBucket: '0.75-0.89',
    } as Awaited<ReturnType<typeof recordInvestigatorLearningFeedback>>);

    const app = buildApp();
    const evidence = await request(app)
      .get('/api/evidence/ev_1')
      .expect(200);
    const calibration = await request(app)
      .get('/api/learning/calibration')
      .expect(200);
    const feedback = await request(app)
      .post('/api/learning/feedback')
      .send({
        findingId: 'finding_1',
        resolution: 'true_positive_actionable',
      })
      .expect(201);

    expect(evidence.body.schema).toBe('https://vitalcv.com/evidence/viewer/v1');
    expect(calibration.body.schema).toBe('https://vitalcv.com/learning/calibration/v1');
    expect(feedback.body.schema).toBe('https://vitalcv.com/learning/feedback/v1');
  });
});
