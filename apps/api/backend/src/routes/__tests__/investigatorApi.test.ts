import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../services/investigators/investigatorEngineService', () => ({
  runTargetedInvestigators: jest.fn(),
}));

jest.mock('../../services/investigators/investigatorScheduler', () => ({
  getInvestigatorSchedulerState: jest.fn(),
}));

jest.mock('../../services/investigators/autonomousInvestigatorEngine', () => ({
  AUTONOMOUS_INVESTIGATOR_SPECS: [
    { id: 'autonomous_investigator_daily' },
    { id: 'autonomous_investigator_weekly' },
  ],
  getAutonomousInvestigatorStatus: jest.fn(),
}));

jest.mock('../../services/investigators/ignitionInvestigators', () => ({
  IGNITION_INVESTIGATOR_IDS: [
    'sanctions',
    'clinical_trial',
    'institution_expansion',
    'workforce_shift',
    'research_momentum',
    'industry_influence',
  ],
}));

import { runTargetedInvestigators } from '../../services/investigators/investigatorEngineService';
import { getInvestigatorSchedulerState } from '../../services/investigators/investigatorScheduler';
import { getAutonomousInvestigatorStatus } from '../../services/investigators/autonomousInvestigatorEngine';
import { registerInvestigatorApiRoutes } from '../investigatorApi';

const runTargetedInvestigatorsMock = runTargetedInvestigators as jest.MockedFunction<typeof runTargetedInvestigators>;
const getInvestigatorSchedulerStateMock = getInvestigatorSchedulerState as jest.MockedFunction<typeof getInvestigatorSchedulerState>;
const getAutonomousInvestigatorStatusMock = getAutonomousInvestigatorStatus as jest.MockedFunction<typeof getAutonomousInvestigatorStatus>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerInvestigatorApiRoutes(app);
  return app;
}

describe('investigatorApi routes', () => {
  beforeEach(() => {
    runTargetedInvestigatorsMock.mockReset();
    getInvestigatorSchedulerStateMock.mockReset();
    getAutonomousInvestigatorStatusMock.mockReset();
  });

  it('runs the ignition investigator set and normalizes provider targets', async () => {
    runTargetedInvestigatorsMock.mockResolvedValue([
      {
        runId: 'run_123',
        investigatorId: 'sanctions',
        trigger: 'manual',
        startedAt: '2026-03-15T12:00:00.000Z',
        completedAt: '2026-03-15T12:00:03.000Z',
        durationMs: 3000,
        findingsGenerated: 2,
        findingsCreated: 2,
        findingsUpdated: 0,
        findingsResolved: 0,
        findingsSuppressed: 0,
        storylinesMerged: 1,
        coveredEntityIds: ['1234567890'],
        persistedFindings: [],
      },
    ]);

    const response = await request(buildApp())
      .post('/api/investigator/run')
      .send({
        npi: ['1234567890', '1234567890', 'invalid'],
      })
      .expect(200);

    expect(runTargetedInvestigatorsMock).toHaveBeenCalledWith({
      entityType: 'provider',
      targetEntityIds: ['1234567890'],
      investigatorIds: [
        'sanctions',
        'clinical_trial',
        'institution_expansion',
        'workforce_shift',
        'research_momentum',
        'industry_influence',
      ],
      trigger: 'manual',
      metadata: {
        source: 'api_investigator_run',
      },
    });
    expect(response.body.investigatorIds).toEqual([
      'sanctions',
      'clinical_trial',
      'institution_expansion',
      'workforce_shift',
      'research_momentum',
      'industry_influence',
    ]);
    expect(response.body.targetEntityIds).toEqual(['1234567890']);
    expect(response.body.runs).toHaveLength(1);
  });

  it('returns scheduler and source status', async () => {
    getInvestigatorSchedulerStateMock.mockReturnValue({
      running: true,
      inProgress: false,
      lastRunAt: '2026-03-15T09:00:00.000Z',
    });
    getAutonomousInvestigatorStatusMock.mockResolvedValue({
      jobs: [
        {
          id: 'daily-provider-poll',
          cadence: 'daily',
          description: 'Daily critical-source monitoring for exclusions, credentials, and trial participation.',
          sources: ['LEIE', 'NPPES', 'CLINICAL_TRIALS'],
          investigatorId: 'autonomous_investigator_daily',
          lastRunAt: '2026-03-15T08:00:00.000Z',
          nextRunAt: '2026-03-16T08:00:00.000Z',
          findingsGenerated: 4,
        },
      ],
      sources: [
        {
          sourceId: 'LEIE',
          label: 'LEIE',
          lastSeenAt: '2026-03-15T08:00:00.000Z',
          recordCount: 12,
        },
      ],
    });

    const response = await request(buildApp())
      .get('/api/investigator/status')
      .expect(200);

    expect(getInvestigatorSchedulerStateMock).toHaveBeenCalledTimes(1);
    expect(getAutonomousInvestigatorStatusMock).toHaveBeenCalledTimes(1);
    expect(response.body.scheduler.running).toBe(true);
    expect(response.body.jobs[0].id).toBe('daily-provider-poll');
    expect(response.body.sources[0].sourceId).toBe('LEIE');
    expect(response.body.investigatorCount).toBe(6);
    expect(response.body.ignitionInvestigators).toEqual([
      'sanctions',
      'clinical_trial',
      'institution_expansion',
      'workforce_shift',
      'research_momentum',
      'industry_influence',
    ]);
  });
});
