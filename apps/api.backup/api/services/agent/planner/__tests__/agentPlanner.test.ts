import { jest } from '@jest/globals';
import type { EvidenceAssessment, EvidenceGap } from '../../oracle/evidenceCompleteness.js';
import { generateCredentialAgentPlan } from '../agentPlanner.js';
import { CREDENTIAL_AGENT_TASK_TYPES } from '../../models/CredentialAgentTask.js';

const mockEvaluate = jest.fn();
const mockGetOpenTasks = jest.fn().mockResolvedValue([]);

jest.mock('../../oracle/evidenceCompleteness.js', () => ({
  evaluateEvidenceCompleteness: (...args: unknown[]) => mockEvaluate(...args),
}));

jest.mock('../../models/CredentialAgentTask.js', () => {
  const actual = jest.requireActual('../../models/CredentialAgentTask.js');
  return {
    ...actual,
    getOpenAgentTasks: (...args: unknown[]) => mockGetOpenTasks(...args),
  };
});

function buildAssessment(overrides: Partial<Record<string, Partial<EvidenceGap>>> = {}): EvidenceAssessment {
  const results = {} as Record<string, EvidenceGap>;
  for (const taskType of CREDENTIAL_AGENT_TASK_TYPES) {
    results[taskType] = {
      taskType,
      status: 'COMPLETE',
      severity: 'LOW',
      reason: 'ok',
      ...(overrides[taskType] ?? {}),
    };
  }

  return {
    clinicianId: 'clinician-1',
    clinicianDid: 'did:key:123',
    clinicianNpi: '1234567890',
    narrativeFindings: [],
    results: results as Record<any, EvidenceGap>,
  };
}

describe('CredentialAgentPlanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOpenTasks.mockResolvedValue([]);
  });

  it('orders tasks by severity deterministically', async () => {
    mockEvaluate.mockResolvedValue(
      buildAssessment({
        LICENSE_CHECK: { status: 'FAILED', severity: 'HIGH', reason: 'license expired' },
        PAYER_CHECK: { status: 'STALE', severity: 'MEDIUM', reason: 'revalidation due' },
      })
    );

    const plan = await generateCredentialAgentPlan('clinician-1', { deterministic: true });

    expect(plan.orderedTasks).toHaveLength(2);
    expect(plan.orderedTasks[0]).toMatchObject({
      taskType: 'LICENSE_CHECK',
      priority: 1,
    });
    expect(plan.orderedTasks[1]).toMatchObject({
      taskType: 'PAYER_CHECK',
      priority: 2,
    });
  });

  it('skips tasks that already have active work queued', async () => {
    mockEvaluate.mockResolvedValue(
      buildAssessment({
        NPDB_QUERY: { status: 'MISSING', severity: 'HIGH', reason: 'never run' },
      })
    );
    mockGetOpenTasks.mockResolvedValue([{ taskType: 'NPDB_QUERY' }]);

    const plan = await generateCredentialAgentPlan('clinician-1');

    expect(plan.orderedTasks).toHaveLength(0);
  });

  it('adds narrative-driven recommendations when no structural gaps exist', async () => {
    const assessment = buildAssessment();
    assessment.narrativeFindings = [
      {
        title: 'Manual drift detected',
        description: 'Timeline missing recent FPPE narrative.',
        recommendedTask: 'TIMELINE_REFRESH',
        confidence: 0.71,
      },
    ];
    mockEvaluate.mockResolvedValue(assessment);

    const plan = await generateCredentialAgentPlan('clinician-1', { deterministic: true });

    expect(plan.orderedTasks).toHaveLength(1);
    expect(plan.orderedTasks[0].taskType).toBe('TIMELINE_REFRESH');
    expect(plan.orderedTasks[0].reason).toContain('Timeline missing');
  });
});

