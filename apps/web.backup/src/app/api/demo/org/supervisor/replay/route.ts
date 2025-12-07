import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // TODO: Replace with actual replay data from backend
    // This should query supervisor run history, tasks, and timeline events

    const url = new URL(request.url);
    const runId = url.searchParams.get('runId');
    const orgId = url.searchParams.get('orgId') ?? 'demo-org';

    if (!runId) {
      return NextResponse.json(
        { error: 'runId parameter is required' },
        { status: 400 }
      );
    }

    const run = buildMockRun(runId);
    const tasks = buildMockReplayTasks(runId);
    const timeline = buildMockTimeline(runId);

    return NextResponse.json({
      run,
      tasks,
      timeline,
    });
  } catch (error) {
    console.warn('[API] supervisor replay falling back to mock data', error);
    const url = new URL(request.url);
    const runId = url.searchParams.get('runId') ?? 'mock-run';
    return NextResponse.json(
      {
        run: buildMockRun(runId),
        tasks: buildMockReplayTasks(runId),
        timeline: buildMockTimeline(runId),
      },
      { headers: { 'x-demo-data': 'true' } }
    );
  }
}

function buildMockRun(runId: string) {
  const now = new Date();
  return {
    id: runId,
    startedAt: new Date(now.getTime() - 1800000).toISOString(),
    completedAt: new Date(now.getTime() - 600000).toISOString(),
    status: 'COMPLETED',
    tasksPlanned: 12,
    tasksExecuted: 11,
    tasksBlocked: 1,
    nextRunPrediction: new Date(now.getTime() + 3600000).toISOString(),
    metadata: { orgId: 'demo-org' },
  };
}

function buildMockReplayTasks(runId: string) {
  const now = new Date();
  return [
    {
      id: 'task-1',
      runId,
      queueType: 'PSV_RUN',
      status: 'EXECUTED',
      scheduledAt: new Date(now.getTime() - 1800000).toISOString(),
      executedAt: new Date(now.getTime() - 1700000).toISOString(),
      decisionMetadata: {
        rulesTriggered: ['psv_required_for_new_privilege'],
        signalsUsed: [
          { type: 'license_expiry', severity: 'MEDIUM', value: 45 },
        ],
      },
    },
    {
      id: 'task-2',
      runId,
      queueType: 'SAFETY_SWEEP',
      status: 'EXECUTED',
      scheduledAt: new Date(now.getTime() - 1600000).toISOString(),
      executedAt: new Date(now.getTime() - 1500000).toISOString(),
      decisionMetadata: {
        rulesTriggered: ['safety_sweep_due'],
        signalsUsed: [
          { type: 'safety_incident', severity: 'HIGH', value: 75 },
        ],
      },
    },
    {
      id: 'task-3',
      runId,
      queueType: 'DRIFT_SWEEP',
      status: 'BLOCKED',
      scheduledAt: new Date(now.getTime() - 1400000).toISOString(),
      blockedReason: 'Waiting for EHR sync to complete',
      decisionMetadata: {
        rulesTriggered: ['drift_detection_enabled'],
        signalsUsed: [
          { type: 'ehr_sync_status', severity: 'INFO', value: 0 },
        ],
      },
    },
  ];
}

function buildMockTimeline(runId: string) {
  const now = new Date();
  return [
    {
      timestamp: new Date(now.getTime() - 1800000).toISOString(),
      event: 'Supervisor run started',
      details: { runId },
    },
    {
      timestamp: new Date(now.getTime() - 1750000).toISOString(),
      event: 'Task scheduled: PSV_RUN',
      taskId: 'task-1',
      details: { queueType: 'PSV_RUN', reason: 'psv_required_for_new_privilege' },
    },
    {
      timestamp: new Date(now.getTime() - 1700000).toISOString(),
      event: 'Task executed: PSV_RUN',
      taskId: 'task-1',
      details: { status: 'COMPLETED', duration: '100s' },
    },
    {
      timestamp: new Date(now.getTime() - 1650000).toISOString(),
      event: 'Task scheduled: SAFETY_SWEEP',
      taskId: 'task-2',
      details: { queueType: 'SAFETY_SWEEP', reason: 'safety_sweep_due' },
    },
    {
      timestamp: new Date(now.getTime() - 1600000).toISOString(),
      event: 'Task scheduled: DRIFT_SWEEP',
      taskId: 'task-3',
      details: { queueType: 'DRIFT_SWEEP', reason: 'drift_detection_enabled' },
    },
    {
      timestamp: new Date(now.getTime() - 1500000).toISOString(),
      event: 'Task executed: SAFETY_SWEEP',
      taskId: 'task-2',
      details: { status: 'COMPLETED', duration: '100s' },
    },
    {
      timestamp: new Date(now.getTime() - 1400000).toISOString(),
      event: 'Task blocked: DRIFT_SWEEP',
      taskId: 'task-3',
      details: { reason: 'Waiting for EHR sync to complete' },
    },
    {
      timestamp: new Date(now.getTime() - 600000).toISOString(),
      event: 'Supervisor run completed',
      details: { runId, tasksExecuted: 11, tasksBlocked: 1 },
    },
  ];
}

