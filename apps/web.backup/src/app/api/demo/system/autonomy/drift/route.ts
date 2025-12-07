import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // In a real implementation, would fetch from database
    const detections = [
      {
        id: 'drift_1',
        detectedAt: new Date(Date.now() - 3600000).toISOString(),
        severity: 'HIGH',
        type: 'privilege_drift',
        status: 'OPEN',
        description: 'Privilege assignments drifted for 5 clinicians',
        narrative: 'Detected that privilege assignments for 5 clinicians no longer match expected state based on their credentials and organizational policies.',
      },
      {
        id: 'drift_2',
        detectedAt: new Date(Date.now() - 7200000).toISOString(),
        severity: 'MEDIUM',
        type: 'compliance_drift',
        status: 'RESOLVED',
        description: 'Compliance status drifted for 2 clinicians',
        narrative: 'Compliance status for 2 clinicians drifted from compliant to non-compliant. Automatic reconciliation restored compliance.',
      },
    ]

    return NextResponse.json({ detections })
  } catch (error: any) {
    console.error('Error fetching drift detections:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch drift detections' },
      { status: 500 }
    )
  }
}

