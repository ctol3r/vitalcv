import express from 'express';
import request from 'supertest';

jest.mock('../../services/trust-state', () => ({
  matchRecognitionRequirements: jest.fn(),
  matchActivationRequirements: jest.fn(),
  scoreDeterministicBestAction: jest.fn(),
}));

jest.mock('../../services/employers/pilotPolicy', () => {
  const actual = jest.requireActual('../../services/employers/pilotPolicy');
  return {
    ...actual,
    evaluatePilotReadiness: jest.fn(),
  };
});

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import {
  matchRecognitionRequirements,
  matchActivationRequirements,
  scoreDeterministicBestAction,
} from '../../services/trust-state';
import { evaluatePilotReadiness } from '../../services/employers/pilotPolicy';
import { registerTrustApiRoutes } from '../trustApi';

const matchRecognitionMock = matchRecognitionRequirements as jest.MockedFunction<typeof matchRecognitionRequirements>;
const matchActivationMock = matchActivationRequirements as jest.MockedFunction<typeof matchActivationRequirements>;
const scoreBestActionMock = scoreDeterministicBestAction as jest.MockedFunction<typeof scoreDeterministicBestAction>;
const evaluatePilotReadinessMock = evaluatePilotReadiness as jest.MockedFunction<typeof evaluatePilotReadiness>;

function createApp() {
  const app = express();
  app.use(express.json());
  registerTrustApiRoutes(app);
  return app;
}

describe('trustApi routes', () => {
  beforeEach(() => {
    matchRecognitionMock.mockReset();
    matchActivationMock.mockReset();
    scoreBestActionMock.mockReset();
    evaluatePilotReadinessMock.mockReset();
  });

  it('POST /api/trust/recognition delegates to recognition matching and returns a safe envelope', async () => {
    matchRecognitionMock.mockReturnValue({
      requirementResults: [{
        canonicalArtifactKey: 'state_license',
        requirementLabel: 'CA Medical License',
        requirementWeight: 3,
        priority: 'required',
        mapped: true,
        met: true,
        matchCode: 'MATCHED',
        resolvedLevel: 'L3',
        freshness: 'current',
        revoked: false,
        matchedEvidenceIds: ['license-1'],
        state: 'CA',
        specialty: null,
        reasons: [],
      }],
      blockers: [],
      missingActions: [],
    });

    const response = await request(createApp())
      .post('/api/trust/recognition')
      .send({
        recognition: {
          resolved: [
            {
              canonicalArtifactKey: 'state_license',
              resolvedLevel: 'L3',
              freshness: 'current',
              evidenceId: 'license-1',
              state: 'CA',
            },
          ],
        },
        org: {
          requirements: [
            { label: 'CA Medical License', level: 'L3', state: 'CA' },
          ],
        },
      })
      .expect(200);

    expect(matchRecognitionMock).toHaveBeenCalledWith({
      recognition: {
        resolved: [
          {
            canonicalArtifactKey: 'state_license',
            key: null,
            requirementLabel: null,
            label: null,
            status: null,
            resolvedLevel: 'L3',
            freshness: 'current',
            revoked: false,
            evidenceId: 'license-1',
            source: null,
            reason: null,
            state: 'CA',
            specialty: null,
          },
        ],
      },
      orgRequirements: [
        { label: 'CA Medical License', level: 'L3', state: 'CA' },
      ],
    });
    expect(response.body).toEqual({
      ok: true,
      schema: 'vitalcv.trust.recognition.v1',
      result: {
        requirementResults: expect.any(Array),
        blockers: [],
        missingActions: [],
      },
    });
  });

  it('POST /api/trust/acceptance delegates to pilot readiness evaluation and wraps blockers safely', async () => {
    evaluatePilotReadinessMock.mockReturnValue({
      ready: false,
      autoAccept: false,
      psvRequired: true,
      triggerDecisionCapsuleOnHire: false,
      trustBand: 'L2',
      readinessScore: 72,
      reason: 'Trust gaps require PSV only for the missing evidence.',
    });

    const response = await request(createApp())
      .post('/api/trust/acceptance')
      .send({
        trustState: {
          readiness_level: 'L2',
          readiness_score: 72,
          gap_summary: ['DEA Registration'],
        },
        policy: {
          pilotMode: true,
          organizationAcceptanceRules: {
            requirePsvOnlyForGaps: true,
            acceptL3CredentialsAutomatically: false,
          },
        },
      })
      .expect(200);

    expect(evaluatePilotReadinessMock).toHaveBeenCalledWith(
      {
        readiness_level: 'L2',
        readiness_score: 72,
        gap_summary: ['DEA Registration'],
      },
      expect.objectContaining({
        pilotMode: true,
        organizationAcceptanceRules: {
          requirePsvOnlyForGaps: true,
          acceptL3CredentialsAutomatically: false,
        },
      }),
    );
    expect(response.body).toEqual({
      ok: true,
      schema: 'vitalcv.trust.acceptance.v1',
      result: {
        evaluation: {
          ready: false,
          autoAccept: false,
          psvRequired: true,
          triggerDecisionCapsuleOnHire: false,
          trustBand: 'L2',
          readinessScore: 72,
          reason: 'Trust gaps require PSV only for the missing evidence.',
        },
        blockers: [
          {
            blockerId: 'acceptance_not_ready',
            label: 'Acceptance not ready',
            detail: 'Trust gaps require PSV only for the missing evidence.',
          },
        ],
      },
    });
  });

  it('POST /api/trust/startability delegates to activation matching and returns a safe envelope', async () => {
    matchActivationMock.mockReturnValue({
      satisfiedUnits: [],
      blockers: [
        {
          unit: 'start_ready',
          label: 'Start ready',
          detail: 'Readiness score 72 is below the required threshold 80.',
          estimatedDays: 5,
        },
      ],
      estimated_days_to_start: 5,
    });

    const response = await request(createApp())
      .post('/api/trust/startability')
      .send({
        acceptanceOutput: {
          trustSnapshot: {
            readinessScore: 72,
            blockerCount: 2,
            topBlockers: ['License expired'],
          },
        },
        activationRequirements: [
          { unit: 'start_ready', minimumScore: 80, estimatedDays: 5 },
        ],
      })
      .expect(200);

    expect(matchActivationMock).toHaveBeenCalledWith({
      acceptanceOutput: {
        timestamp: null,
        auditEventId: null,
        attribution: null,
        persistence: null,
        acceptance: null,
        trustSnapshot: {
          readinessScore: 72,
          blockerCount: 2,
          topBlockers: ['License expired'],
        },
      },
      activationRequirements: [
        { unit: 'start_ready', estimatedDays: 5, minimumScore: 80, expectedScope: null },
      ],
    });
    expect(response.body).toEqual({
      ok: true,
      schema: 'vitalcv.trust.startability.v1',
      result: {
        satisfiedUnits: [],
        blockers: [
          {
            unit: 'start_ready',
            label: 'Start ready',
            detail: 'Readiness score 72 is below the required threshold 80.',
            estimatedDays: 5,
          },
        ],
        estimated_days_to_start: 5,
      },
    });
  });

  it('POST /api/trust/full composes existing engines and returns the scored best action', async () => {
    matchRecognitionMock.mockReturnValue({
      requirementResults: [],
      blockers: [],
      missingActions: [
        {
          id: 'missing-dea',
          canonicalArtifactKey: 'dea_registration',
          requirementLabel: 'DEA Registration',
          blocking: true,
          priority: 'HIGH',
          title: 'Resolve DEA registration',
          detail: 'Recognition does not include a resolved fact for DEA Registration.',
        },
      ],
    });
    evaluatePilotReadinessMock.mockReturnValue({
      ready: false,
      autoAccept: false,
      psvRequired: false,
      triggerDecisionCapsuleOnHire: false,
      trustBand: 'L2',
      readinessScore: 70,
      reason: 'Manual review required under the current pilot acceptance policy.',
    });
    matchActivationMock.mockReturnValue({
      satisfiedUnits: [],
      blockers: [
        {
          unit: 'start_ready',
          label: 'Start ready',
          detail: 'Trust snapshot still has blockers (1). Lead blocker: DEA Registration',
          estimatedDays: 4,
        },
      ],
      estimated_days_to_start: 4,
    });
    scoreBestActionMock.mockReturnValue({
      domain: 'activation',
      blockerId: 'start_ready',
      blocker_label: 'Start ready',
      title: 'Resolve Start ready',
      detail: 'Trust snapshot still has blockers (1). Lead blocker: DEA Registration',
      effort_estimate: 4,
    });

    const response = await request(createApp())
      .post('/api/trust/full')
      .send({
        recognition: { resolved: [] },
        orgRequirements: [{ label: 'DEA Registration', level: 'L2' }],
        trustState: { readiness_level: 'L2', readiness_score: 70, gap_summary: ['DEA Registration'] },
        policy: { pilotMode: true },
        acceptanceOutput: {
          trustSnapshot: {
            readinessScore: 84,
            blockerCount: 1,
            topBlockers: ['DEA Registration'],
          },
        },
        activationRequirements: [{ unit: 'start_ready', estimatedDays: 4 }],
      })
      .expect(200);

    expect(scoreBestActionMock).toHaveBeenCalledWith({
      blockers: [
        {
          domain: 'recognition',
          blockerId: 'missing-dea',
          label: 'DEA Registration',
          detail: 'Recognition does not include a resolved fact for DEA Registration.',
          actionTitle: 'Resolve DEA registration',
          actionDetail: 'Recognition does not include a resolved fact for DEA Registration.',
          effort_estimate: null,
        },
        {
          domain: 'acceptance',
          blockerId: 'acceptance_not_ready',
          label: 'Acceptance not ready',
          detail: 'Manual review required under the current pilot acceptance policy.',
          actionTitle: 'Complete acceptance review',
          actionDetail: 'Manual review required under the current pilot acceptance policy.',
          effort_estimate: null,
        },
        {
          domain: 'activation',
          blockerId: 'start_ready',
          label: 'Start ready',
          detail: 'Trust snapshot still has blockers (1). Lead blocker: DEA Registration',
          actionTitle: 'Resolve Start ready',
          actionDetail: 'Trust snapshot still has blockers (1). Lead blocker: DEA Registration',
          effort_estimate: 4,
        },
      ],
    });
    expect(response.body).toEqual({
      ok: true,
      schema: 'vitalcv.trust.full.v1',
      result: {
        recognition: {
          requirementResults: [],
          blockers: [],
          missingActions: [
            {
              id: 'missing-dea',
              canonicalArtifactKey: 'dea_registration',
              requirementLabel: 'DEA Registration',
              blocking: true,
              priority: 'HIGH',
              title: 'Resolve DEA registration',
              detail: 'Recognition does not include a resolved fact for DEA Registration.',
            },
          ],
        },
        acceptance: {
          evaluation: {
            ready: false,
            autoAccept: false,
            psvRequired: false,
            triggerDecisionCapsuleOnHire: false,
            trustBand: 'L2',
            readinessScore: 70,
            reason: 'Manual review required under the current pilot acceptance policy.',
          },
          blockers: [
            {
              blockerId: 'acceptance_not_ready',
              label: 'Acceptance not ready',
              detail: 'Manual review required under the current pilot acceptance policy.',
            },
          ],
        },
        startability: {
          satisfiedUnits: [],
          blockers: [
            {
              unit: 'start_ready',
              label: 'Start ready',
              detail: 'Trust snapshot still has blockers (1). Lead blocker: DEA Registration',
              estimatedDays: 4,
            },
          ],
          estimated_days_to_start: 4,
        },
        best_action_status: 'action_required',
        best_action: {
          domain: 'activation',
          blockerId: 'start_ready',
          blocker_label: 'Start ready',
          title: 'Resolve Start ready',
          detail: 'Trust snapshot still has blockers (1). Lead blocker: DEA Registration',
          effort_estimate: 4,
        },
      },
    });
  });

  it('returns explicit all_clear status when no best action remains', async () => {
    matchRecognitionMock.mockReturnValue({
      requirementResults: [],
      blockers: [],
      missingActions: [],
    });
    evaluatePilotReadinessMock.mockReturnValue({
      ready: true,
      autoAccept: true,
      psvRequired: false,
      triggerDecisionCapsuleOnHire: false,
      trustBand: 'L3',
      readinessScore: 92,
      reason: 'L3 credentials qualify for automatic acceptance under pilot policy.',
    });
    matchActivationMock.mockReturnValue({
      satisfiedUnits: [],
      blockers: [],
      estimated_days_to_start: 0,
    });
    scoreBestActionMock.mockReturnValue(null);

    const response = await request(createApp())
      .post('/api/trust/full')
      .send({
        recognition: { resolved: [] },
        trustState: { readiness_level: 'L3', readiness_score: 92, gap_summary: [] },
        acceptanceOutput: { trustSnapshot: { readinessScore: 92, blockerCount: 0, topBlockers: [] } },
      })
      .expect(200);

    expect(response.body.result.best_action_status).toBe('all_clear');
    expect(response.body.result.best_action).toBeNull();
  });

  it('returns 400 when a required stage payload is missing', async () => {
    const response = await request(createApp())
      .post('/api/trust/full')
      .send({
        trustState: { readiness_level: 'L2', readiness_score: 70, gap_summary: [] },
        acceptanceOutput: {},
      })
      .expect(400);

    expect(response.body.message ?? response.body.error).toContain('recognition is required');
  });
});
