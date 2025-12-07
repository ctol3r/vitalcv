import { recordPilotSmokeRun, PilotSmokeTestResult } from '../pilotAnalytics';
import { recordAnalyticsEvent } from '../../analytics/models/AnalyticsEvent';

jest.mock('../../analytics/models/AnalyticsEvent', () => ({
  recordAnalyticsEvent: jest.fn(),
}));

describe('pilotAnalytics', () => {
  const mockRecord = recordAnalyticsEvent as jest.MockedFunction<typeof recordAnalyticsEvent>;

  beforeEach(() => {
    mockRecord.mockReset();
  });

  const baseResult: PilotSmokeTestResult = {
    success: true,
    totalDuration: 250,
    timestamp: new Date('2025-11-14T00:00:00Z').toISOString(),
    steps: [
      {
        step: 'issue_credential',
        status: 'success',
        duration: 100,
        timestamp: new Date().toISOString(),
      },
    ],
    summary: {
      passed: 1,
      failed: 0,
      total: 1,
    },
  };

  it('records pilot smoke run analytics events', async () => {
    await recordPilotSmokeRun(baseResult, { runId: 'smoke-123', triggeredBy: 'cron' });

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PILOT_SMOKE_RUN',
        subjectId: 'smoke-123',
      })
    );

    const metadata = mockRecord.mock.calls[0][0].metadata as any;
    expect(metadata.success).toBe(true);
    expect(metadata.failures).toHaveLength(0);
    expect(metadata.triggeredBy).toBe('cron');
  });

  it('captures failure details when steps error', async () => {
    const failingResult: PilotSmokeTestResult = {
      ...baseResult,
      success: false,
      errorMessage: 'Verifier down',
      steps: [
        ...baseResult.steps,
        {
          step: 'verify_presentation',
          status: 'failure',
          duration: 80,
          timestamp: new Date().toISOString(),
          error: 'Verifier not responding',
        },
      ],
      summary: {
        passed: 1,
        failed: 1,
        total: 2,
      },
    };

    await recordPilotSmokeRun(failingResult);

    const metadata = mockRecord.mock.calls[0][0].metadata as any;
    expect(metadata.success).toBe(false);
    expect(metadata.failures).toHaveLength(1);
    expect(metadata.failures[0]).toEqual({
      step: 'verify_presentation',
      error: 'Verifier not responding',
    });
    expect(metadata.errorMessage).toBe('Verifier down');
  });
});


