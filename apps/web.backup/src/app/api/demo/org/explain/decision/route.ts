import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const decisionId = searchParams.get('id')

    if (!decisionId) {
      return NextResponse.json(
        { error: 'Decision ID is required' },
        { status: 400 }
      )
    }

    // In a real implementation, would fetch decision data from database
    // and use the explainability services to build graph and narrative
    // For now, return mock data structure

    const now = new Date()
    const graph = {
      id: `graph_${decisionId}`,
      createdAt: now.toISOString(),
      rootNodeId: 'node_0',
      nodes: [
        {
          id: 'node_0',
          type: 'signal_collection',
          label: 'Signal Collection',
          timestamp: new Date(now.getTime() - 60000).toISOString(),
          data: {
            signals: {
              drift: { openCount: 5, criticalCount: 1, highCount: 2, recentCount: 3 },
              safety: { activeCount: 2, criticalCount: 0, highCount: 1, recentCount: 1 },
              compliance: { totalFailures: 0, recentFailures: 0, criticalFailures: 0 },
            },
          },
        },
        {
          id: 'node_1',
          type: 'supervisor_decision',
          label: 'Supervisor Decision: RUN_DRIFT_SWEEP',
          timestamp: new Date(now.getTime() - 30000).toISOString(),
          data: {
            taskType: 'RUN_DRIFT_SWEEP',
            decision: 'allowed',
            reason: 'Policy check passed',
          },
        },
        {
          id: 'node_2',
          type: 'module_invocation',
          label: 'Module: drift-module',
          timestamp: new Date(now.getTime() - 20000).toISOString(),
          data: {
            moduleId: 'drift-module',
            capability: 'drift.sweep',
            input: {},
            outcome: { success: true, result: { eventsFound: 5, resolved: 3 } },
          },
        },
        {
          id: 'node_3',
          type: 'outcome',
          label: 'Outcome: drift_sweep_completed',
          timestamp: now.toISOString(),
          data: {
            type: 'drift_sweep_completed',
            result: { eventsProcessed: 5, eventsResolved: 3 },
          },
        },
      ],
      edges: [
        {
          id: 'edge_0',
          source: 'node_0',
          target: 'node_1',
          type: 'triggered_by',
          label: 'Signals triggered decision',
        },
        {
          id: 'edge_1',
          source: 'node_1',
          target: 'node_2',
          type: 'routes_to',
          label: 'Routes to drift-module',
        },
        {
          id: 'edge_2',
          source: 'node_2',
          target: 'node_3',
          type: 'produces',
          label: 'Produces outcome',
        },
      ],
    }

    const narrative = {
      id: `narrative_${decisionId}`,
      title: 'Decision Explanation: RUN_DRIFT_SWEEP',
      createdAt: now.toISOString(),
      executiveSummary:
        'The supervisor made 1 decision(s): RUN_DRIFT_SWEEP: allowed. This resulted in 1 outcome(s): drift_sweep_completed. The decision process involved 4 steps and 3 relationships.',
      sections: [
        {
          type: 'signal_analysis',
          title: 'Signal Collection',
          content:
            'The system collected the following signals:\n\n- Drift Signals: 5 open events (1 critical, 2 high)\n- Safety Signals: 2 active (0 critical, 1 high)\n- Compliance Failures: 0 total (0 recent)\n',
          nodeIds: ['node_0'],
          edgeIds: ['edge_0'],
        },
        {
          type: 'decision_point',
          title: 'Decision: RUN_DRIFT_SWEEP',
          content:
            'The supervisor evaluated whether to execute task: RUN_DRIFT_SWEEP.\n\nDecision: ALLOWED\nReason: Policy check passed\n\nThis decision was triggered by:\n- Signal Collection (triggered_by)\n\nThis decision led to:\n- Module: drift-module (routes_to)\n',
          nodeIds: ['node_1'],
          edgeIds: ['edge_0', 'edge_1'],
          policyReferences: ['Policy: RUN_DRIFT_SWEEP'],
        },
        {
          type: 'module_execution',
          title: 'Module Execution: drift-module',
          content:
            'Module: drift-module\nCapability: drift.sweep\n\nExecution: SUCCESS\nResult: {\n  "eventsFound": 5,\n  "resolved": 3\n}\n',
          nodeIds: ['node_2'],
          edgeIds: ['edge_1', 'edge_2'],
        },
        {
          type: 'outcome',
          title: 'Outcome: drift_sweep_completed',
          content:
            'Outcome Type: drift_sweep_completed\nResult: {\n  "eventsProcessed": 5,\n  "eventsResolved": 3\n}\n',
          nodeIds: ['node_3'],
          edgeIds: ['edge_2'],
        },
      ],
      fullText: '',
    }

    return NextResponse.json({
      graph,
      narrative,
    })
  } catch (error: any) {
    console.error('Error generating decision explanation:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate explanation' },
      { status: 500 }
    )
  }
}

