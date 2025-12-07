import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // TODO: Replace with actual supervisor data from backend
    // This should query supervisor runs, tasks, and predictions from the queue system

    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId') ?? 'demo-org';

    // Mock data for supervisor dashboard
    const now = new Date();
    const runs = buildMockRuns(now);
    const tasks = buildMockTasks(now);
    const nextRunPrediction = new Date(now.getTime() + 3600000).toISOString(); // 1 hour from now

    return NextResponse.json({
      runs,
      tasks,
      nextRunPrediction,
    });
  } catch (error) {
    console.warn('[API] supervisor dashboard falling back to mock data', error);
    const now = new Date();
    return NextResponse.json(
      {
        runs: buildMockRuns(now),
        tasks: buildMockTasks(now),
        nextRunPrediction: null,
      },
      { headers: { 'x-demo-data': 'true' } }
    );
  }
}

function buildMockRuns(now: Date) {
  return [
    {
      id: 'run-' + Date.now(),
      startedAt: new Date(now.getTime() - 1800000).toISOString(), // 30 min ago
      completedAt: new Date(now.getTime() - 600000).toISOString(), // 10 min ago
      status: 'COMPLETED',
      tasksPlanned: 12,
      tasksExecuted: 11,
      tasksBlocked: 1,
      nextRunPrediction: new Date(now.getTime() + 3600000).toISOString(),
      metadata: { orgId: 'demo-org' },
    },
    {
      id: 'run-' + (Date.now() - 3600000),
      startedAt: new Date(now.getTime() - 7200000).toISOString(), // 2 hours ago
      completedAt: new Date(now.getTime() - 5400000).toISOString(), // 1.5 hours ago
      status: 'COMPLETED',
      tasksPlanned: 8,
      tasksExecuted: 8,
      tasksBlocked: 0,
      nextRunPrediction: null,
      metadata: { orgId: 'demo-org' },
    },
    {
      id: 'run-' + (Date.now() - 7200000),
      startedAt: new Date(now.getTime() - 300000).toISOString(), // 5 min ago
      status: 'RUNNING',
      tasksPlanned: 15,
      tasksExecuted: 5,
      tasksBlocked: 2,
      nextRunPrediction: null,
      metadata: { orgId: 'demo-org' },
    },
  ];
}

function buildMockTasks(now: Date) {
  return [
    {
      id: 'task-psv-1',
      runId: 'run-' + Date.now(),
      queueType: 'PSV_RUN',
      status: 'EXECUTED',
      scheduledAt: new Date(now.getTime() - 1800000).toISOString(),
      executedAt: new Date(now.getTime() - 1700000).toISOString(),
      decisionMetadata: {
        rulesTriggered: ['psv_required_for_new_privilege', 'license_verification_needed'],
        signalsUsed: [
          { type: 'license_expiry', severity: 'MEDIUM', value: 45 },
          { type: 'credential_status', severity: 'LOW', value: 10 },
        ],
      },
    },
    {
      id: 'task-safety-1',
      runId: 'run-' + Date.now(),
      queueType: 'SAFETY_SWEEP',
      status: 'EXECUTED',
      scheduledAt: new Date(now.getTime() - 1600000).toISOString(),
      executedAt: new Date(now.getTime() - 1500000).toISOString(),
      decisionMetadata: {
        rulesTriggered: ['safety_sweep_due', 'privilege_review_required'],
        signalsUsed: [
          { type: 'safety_incident', severity: 'HIGH', value: 75 },
          { type: 'quality_score', severity: 'MEDIUM', value: 60 },
        ],
      },
    },
    {
      id: 'task-drift-1',
      runId: 'run-' + Date.now(),
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
    {
      id: 'task-fusion-1',
      runId: 'run-' + Date.now(),
      queueType: 'FUSION_UPDATE',
      status: 'PLANNED',
      scheduledAt: new Date(now.getTime() - 1200000).toISOString(),
      decisionMetadata: {
        rulesTriggered: ['fusion_score_update_needed'],
        signalsUsed: [
          { type: 'quality_metrics', severity: 'LOW', value: 20 },
        ],
      },
    },
  ];
}

