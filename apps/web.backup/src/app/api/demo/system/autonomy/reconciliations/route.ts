import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // In a real implementation, would fetch from database
    const reconciliations = [
      {
        id: 'recon_1',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3000000).toISOString(),
        status: 'completed',
        type: 'privilege_reconciliation',
        description: 'Reconciled privilege assignments for 5 clinicians',
        narrative: 'Automatically reconciled privilege assignments that had drifted from expected state. Restored correct privileges based on current credentials and policies.',
        changes: [
          {
            resource: 'clinician_123',
            action: 'restored_privileges',
            before: { privileges: ['privilege_A'] },
            after: { privileges: ['privilege_A', 'privilege_B'] },
          },
        ],
      },
      {
        id: 'recon_2',
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        status: 'in_progress',
        type: 'compliance_reconciliation',
        description: 'Reconciling compliance status for 2 clinicians',
        narrative: 'Currently reconciling compliance status that drifted from expected state.',
      },
    ]

    return NextResponse.json({ reconciliations })
  } catch (error: any) {
    console.error('Error fetching reconciliations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reconciliations' },
      { status: 500 }
    )
  }
}

