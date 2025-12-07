import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // TODO: Replace with actual queue data from backend
    // This should query queue loads from the JobQueue system

    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId') ?? 'demo-org';

    const queues = buildMockQueues();

    return NextResponse.json({ queues });
  } catch (error) {
    console.warn('[API] supervisor queues falling back to mock data', error);
    return NextResponse.json(
      { queues: buildMockQueues() },
      { headers: { 'x-demo-data': 'true' } }
    );
  }
}

function buildMockQueues() {
  return [
    {
      queueType: 'PSV',
      pending: 12,
      running: 3,
      completed: 245,
      failed: 2,
      avgLatencyMs: 1250,
    },
    {
      queueType: 'SAFETY',
      pending: 5,
      running: 1,
      completed: 89,
      failed: 0,
      avgLatencyMs: 890,
    },
    {
      queueType: 'DRIFT',
      pending: 8,
      running: 2,
      completed: 156,
      failed: 1,
      avgLatencyMs: 2100,
    },
    {
      queueType: 'FUSION',
      pending: 15,
      running: 4,
      completed: 312,
      failed: 3,
      avgLatencyMs: 980,
    },
    {
      queueType: 'NCI',
      pending: 3,
      running: 1,
      completed: 67,
      failed: 0,
      avgLatencyMs: 750,
    },
    {
      queueType: 'MOBILITY',
      pending: 7,
      running: 2,
      completed: 123,
      failed: 1,
      avgLatencyMs: 1450,
    },
    {
      queueType: 'EHR_SYNC',
      pending: 20,
      running: 5,
      completed: 456,
      failed: 4,
      avgLatencyMs: 3200,
    },
  ];
}

