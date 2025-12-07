import { NextResponse } from 'next/server';
import type { DriftEventSeverity, DriftEventStatus } from '@prisma/client';
import { listDriftEvents } from 'services/drift/orchestrator.js';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusParams = url.searchParams.getAll('status');
    const severityParams = url.searchParams.getAll('severity');
    const orgId = url.searchParams.get('orgId') ?? undefined;

    const events = await listDriftEvents({
      status: statusParams.length ? (statusParams as DriftEventStatus[]) : undefined,
      severity: severityParams.length ? (severityParams as DriftEventSeverity[]) : undefined,
      orgId,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.warn('[API] drift list falling back to mock data', error);
    return NextResponse.json(
      { events: buildMockEvents() },
      { headers: { 'x-demo-data': 'true' } }
    );
  }
}

function buildMockEvents() {
  const now = new Date();
  return [
    {
      id: 'mock-drift-1',
      summary: 'Privileges expired for Cath Lab',
      severity: 'CRITICAL',
      status: 'OPEN',
      category: 'PRIVILEGE',
      lastDetectedAt: now.toISOString(),
      orgId: 'demo-org',
      recommendation: 'Hold cath lab card pending review',
      metadata: {
        privilegeGrantedId: 'mock-priv',
        mitigation: {
          type: 'privilege',
          actions: ['privilege_hold'],
        },
      },
    },
    {
      id: 'mock-drift-2',
      summary: 'Payer revalidation overdue for Blue Shield of CA',
      severity: 'WARNING',
      status: 'ACKNOWLEDGED',
      category: 'PAYER',
      lastDetectedAt: new Date(now.getTime() - 86400000).toISOString(),
      orgId: 'demo-org',
      recommendation: 'Kick off eligibility recalculation',
      metadata: {
        payerEnrollmentId: 'mock-enroll',
        mitigation: {
          eligibility: { overallStatus: 'FAIL' },
        },
      },
    },
  ];
}

