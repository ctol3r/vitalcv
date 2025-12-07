/**
 * API Route: GET /api/demo/org/modules
 *
 * Returns list of all modules with their metadata, capabilities, and health.
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock data for demonstration - in production this would fetch from backend service
function getMockModules() {
  const now = new Date();
  return [
    {
      id: 'psv-module',
      name: 'PSV Module',
      enabled: true,
      version: '1.0.0',
      capabilities: [
        { id: 'psv.run', type: 'task', name: 'Run PSV Check' },
        { id: 'psv.verify', type: 'task', name: 'Verify Credentials' },
      ],
      health: {
        failureRate: 0.02,
        lastError: undefined,
        lastErrorAt: undefined,
      },
      errorCount: 0,
      metadata: {
        description: 'Primary Source Verification module',
        author: 'Chai VC Team',
        tags: ['psv', 'verification'],
      },
    },
    {
      id: 'drift-module',
      name: 'Drift Detection Module',
      enabled: true,
      version: '1.2.0',
      capabilities: [
        { id: 'drift.sweep', type: 'task', name: 'Drift Sweep' },
        { id: 'drift.detect', type: 'event', name: 'Drift Event' },
      ],
      health: {
        failureRate: 0.01,
        lastError: undefined,
        lastErrorAt: undefined,
      },
      errorCount: 0,
      metadata: {
        description: 'Compliance drift detection and monitoring',
        author: 'Chai VC Team',
        tags: ['drift', 'compliance'],
      },
    },
    {
      id: 'safety-module',
      name: 'Safety Module',
      enabled: true,
      version: '1.1.0',
      capabilities: [
        { id: 'safety.sweep', type: 'task', name: 'Safety Sweep' },
        { id: 'safety.alert', type: 'event', name: 'Safety Alert' },
      ],
      health: {
        failureRate: 0.03,
        lastError: 'Timeout on last sweep',
        lastErrorAt: new Date(now.getTime() - 3600000).toISOString(),
      },
      errorCount: 1,
      metadata: {
        description: 'Safety signal detection and monitoring',
        author: 'Chai VC Team',
        tags: ['safety', 'signals'],
      },
    },
    {
      id: 'fusion-module',
      name: 'Fusion Module',
      enabled: false,
      version: '2.0.0',
      capabilities: [
        { id: 'fusion.update', type: 'task', name: 'Fusion Update' },
        { id: 'fusion.score', type: 'flow', name: 'Calculate Fusion Score' },
      ],
      health: undefined,
      errorCount: 0,
      metadata: {
        description: 'Quality fusion score calculation',
        author: 'Chai VC Team',
        tags: ['fusion', 'quality'],
      },
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    // TODO: In production, fetch from backend service:
    // const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    // const res = await fetch(`${backendUrl}/api/modules`);
    // const data = await res.json();

    // For now, return mock data
    const modules = getMockModules();

    return NextResponse.json({ modules });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500 }
    );
  }
}

