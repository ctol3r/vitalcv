/**
 * API Route: GET /api/demo/org/modules/capabilities
 *
 * Returns all modules with their capabilities and dependencies.
 */

import { NextRequest, NextResponse } from 'next/server';

function getMockCapabilities() {
  return [
    {
      id: 'psv-module',
      name: 'PSV Module',
      enabled: true,
      capabilities: [
        {
          id: 'psv.run',
          type: 'task',
          name: 'Run PSV Check',
          dependencies: [],
        },
        {
          id: 'psv.verify',
          type: 'task',
          name: 'Verify Credentials',
          dependencies: ['psv.run'],
        },
      ],
      metadata: {
        moduleDependencies: [],
      },
    },
    {
      id: 'drift-module',
      name: 'Drift Detection Module',
      enabled: true,
      capabilities: [
        {
          id: 'drift.sweep',
          type: 'task',
          name: 'Drift Sweep',
          dependencies: [],
        },
        {
          id: 'drift.detect',
          type: 'event',
          name: 'Drift Event',
          dependencies: ['drift.sweep'],
        },
      ],
      metadata: {
        moduleDependencies: ['psv-module'],
      },
    },
    {
      id: 'safety-module',
      name: 'Safety Module',
      enabled: true,
      capabilities: [
        {
          id: 'safety.sweep',
          type: 'task',
          name: 'Safety Sweep',
          dependencies: [],
        },
        {
          id: 'safety.alert',
          type: 'event',
          name: 'Safety Alert',
          dependencies: ['safety.sweep'],
        },
      ],
      metadata: {
        moduleDependencies: [],
      },
    },
    {
      id: 'fusion-module',
      name: 'Fusion Module',
      enabled: false,
      capabilities: [
        {
          id: 'fusion.update',
          type: 'task',
          name: 'Fusion Update',
          dependencies: ['safety.sweep'],
        },
        {
          id: 'fusion.score',
          type: 'flow',
          name: 'Calculate Fusion Score',
          dependencies: ['fusion.update'],
        },
      ],
      metadata: {
        moduleDependencies: ['safety-module', 'drift-module'],
      },
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    // TODO: In production, fetch from backend service
    const modules = getMockCapabilities();

    return NextResponse.json({ modules });
  } catch (error) {
    console.error('Error fetching capabilities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capabilities' },
      { status: 500 }
    );
  }
}

