import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // TODO: Replace with actual signal data from backend
    // This should query live signals from drift, safety, quality, and enrollment systems

    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId') ?? 'demo-org';

    const signals = buildMockSignals();

    return NextResponse.json({ signals });
  } catch (error) {
    console.warn('[API] supervisor signals falling back to mock data', error);
    return NextResponse.json(
      { signals: buildMockSignals() },
      { headers: { 'x-demo-data': 'true' } }
    );
  }
}

function buildMockSignals() {
  const now = new Date();
  return [
    {
      id: 'signal-drift-1',
      type: 'DRIFT',
      severity: 'CRITICAL',
      label: 'Privilege expiration detected',
      value: 95,
      timestamp: new Date(now.getTime() - 300000).toISOString(),
      metadata: { privilegeGrantedId: 'priv-1' },
    },
    {
      id: 'signal-safety-1',
      type: 'SAFETY',
      severity: 'HIGH',
      label: 'Safety incident reported',
      value: 75,
      timestamp: new Date(now.getTime() - 600000).toISOString(),
      metadata: { incidentId: 'inc-1' },
    },
    {
      id: 'signal-quality-1',
      type: 'QUALITY',
      severity: 'MEDIUM',
      label: 'Quality score below threshold',
      value: 60,
      timestamp: new Date(now.getTime() - 900000).toISOString(),
      metadata: { clinicianId: 'clin-1' },
    },
    {
      id: 'signal-enrollment-1',
      type: 'ENROLLMENT',
      severity: 'LOW',
      label: 'Enrollment verification pending',
      value: 30,
      timestamp: new Date(now.getTime() - 1200000).toISOString(),
      metadata: { enrollmentId: 'enroll-1' },
    },
    {
      id: 'signal-drift-2',
      type: 'DRIFT',
      severity: 'WARNING',
      label: 'Payer revalidation due',
      value: 50,
      timestamp: new Date(now.getTime() - 1800000).toISOString(),
      metadata: { payerId: 'payer-1' },
    },
  ];
}

