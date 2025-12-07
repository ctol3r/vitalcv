import { jest } from '@jest/globals';
import { AgentState, runCredentialAgentStateMachine } from '../stateMachine.js';

const mockTimelineCreate = jest.fn();
const mockGetOpenTasks = jest.fn();
const mockGetFailedTasks = jest.fn();
const mockEnqueueTask = jest.fn();
const mockGeneratePlan = jest.fn();
const mockCreateJob = jest.fn();

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn(() => ({
      credentialTimelineEvent: {
        create: mockTimelineCreate,
      },
    })),
  };
});

jest.mock('../models/CredentialAgentTask.js', () => {
  const actual = jest.requireActual('../models/CredentialAgentTask.js');
  return {
    ...actual,
    getOpenAgentTasks: (...args: unknown[]) => mockGetOpenTasks(...args),
    getFailedAgentTasks: (...args: unknown[]) => mockGetFailedTasks(...args),
    enqueueCredentialAgentTask: (...args: unknown[]) => mockEnqueueTask(...args),
  };
});

jest.mock('../planner/agentPlanner.js', () => ({
  generateCredentialAgentPlan: (...args: unknown[]) => mockGeneratePlan(...args),
}));

jest.mock('../../queue/models/JobQueue.js', () => ({
  createJobQueueEntry: (...args: unknown[]) => mockCreateJob(...args),
}));

describe('Credential agent state machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOpenTasks.mockResolvedValue([]);
    mockGetFailedTasks.mockResolvedValue([]);
    mockEnqueueTask.mockResolvedValue({ task: { id: 'task-1' }, created: true });
    mockGeneratePlan.mockResolvedValue({
      clinicianId: 'clinician-1',
      orderedTasks: [],
      assessment: { results: {}, narrativeFindings: [], clinicianId: 'clinician-1' },
    });
    mockCreateJob.mockResolvedValue({ id: 'job-1' });
  });

  it('returns FAILED state when failed tasks exist', async () => {
    mockGetFailedTasks.mockResolvedValue([{ id: 'failed-1' }]);

    const result = await runCredentialAgentStateMachine('clinician-1');

    expect(result.state).toBe(AgentState.FAILED);
    expect(result.failedTaskIds).toEqual(['failed-1']);
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });

  it('returns EXECUTING when open tasks exist', async () => {
    mockGetOpenTasks.mockResolvedValue([{ id: 'open-1' }]);

    const result = await runCredentialAgentStateMachine('clinician-2');

    expect(result.state).toBe(AgentState.EXECUTING);
    expect(result.enqueuedJobIds).toHaveLength(0);
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });

  it('enqueues new plan items and schedules queue jobs', async () => {
    mockGeneratePlan.mockResolvedValue({
      clinicianId: 'clinician-3',
      orderedTasks: [
        { taskType: 'LICENSE_CHECK', payload: { foo: 'bar' } },
        { taskType: 'NPDB_QUERY' },
      ],
      assessment: { results: {}, narrativeFindings: [], clinicianId: 'clinician-3' },
    });
    mockEnqueueTask
      .mockResolvedValueOnce({ task: { id: 'task-1' }, created: true })
      .mockResolvedValueOnce({ task: { id: 'task-2' }, created: false });
    mockCreateJob.mockResolvedValue({ id: 'job-123' });

    const result = await runCredentialAgentStateMachine('clinician-3');

    expect(result.state).toBe(AgentState.EXECUTING);
    expect(result.plannedTasks).toEqual(['LICENSE_CHECK', 'NPDB_QUERY']);
    expect(result.enqueuedJobIds).toEqual(['job-123']);
    expect(mockEnqueueTask).toHaveBeenCalledTimes(2);
    expect(mockTimelineCreate).toHaveBeenCalled();
  });

  it('transitions to DONE when no work remains', async () => {
    const result = await runCredentialAgentStateMachine('clinician-4');

    expect(result.state).toBe(AgentState.DONE);
    expect(mockTimelineCreate).toHaveBeenCalledTimes(2);
  });
});

