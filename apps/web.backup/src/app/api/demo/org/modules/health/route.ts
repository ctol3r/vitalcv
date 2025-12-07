/**
 * API Route: GET /api/demo/org/modules/health
 *
 * Returns health metrics for all modules: uptime, latency, failure rate, etc.
 */

import { NextRequest, NextResponse } from 'next/server';

function getMockHealth() {
  const now = new Date();
  const startTime = new Date(now.getTime() - 86400000 * 2); // 2 days ago
  const uptime = Math.floor((now.getTime() - startTime.getTime()) / 1000);

  return [
    {
      id: 'psv-module',
      name: 'PSV Module',
      enabled: true,
      version: '1.0.0',
      health: {
        uptime,
        latency: 245,
        failureRate: 0.02,
        lastError: undefined,
        lastErrorAt: undefined,
        eventThroughput: 12.5,
        lastChecked: now.toISOString(),
      },
    },
    {
      id: 'drift-module',
      name: 'Drift Detection Module',
      enabled: true,
      version: '1.2.0',
      health: {
        uptime,
        latency: 180,
        failureRate: 0.01,
        lastError: undefined,
        lastErrorAt: undefined,
        eventThroughput: 8.3,
        lastChecked: now.toISOString(),
      },
    },
    {
      id: 'safety-module',
      name: 'Safety Module',
      enabled: true,
      version: '1.1.0',
      health: {
        uptime,
        latency: 320,
        failureRate: 0.03,
        lastError: 'Timeout on last sweep',
        lastErrorAt: new Date(now.getTime() - 3600000).toISOString(),
        eventThroughput: 15.2,
        lastChecked: now.toISOString(),
      },
    },
    {
      id: 'fusion-module',
      name: 'Fusion Module',
      enabled: false,
      version: '2.0.0',
      health: undefined,
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    // TODO: In production, fetch from backend service
    const modules = getMockHealth();

    return NextResponse.json({ modules });
  } catch (error) {
    console.error('Error fetching module health:', error);
    return NextResponse.json(
      { error: 'Failed to fetch module health' },
      { status: 500 }
    );
  }
}

