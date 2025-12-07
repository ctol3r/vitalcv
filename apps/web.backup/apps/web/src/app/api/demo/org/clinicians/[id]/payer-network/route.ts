import { NextResponse } from 'next/server';
import {
  buildPayerNetworkGraph,
  fetchPayerNetworkGraph,
  type GraphEnrollmentSnapshot,
} from 'services/payer/networkGraph';

export async function GET(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const graph = await fetchPayerNetworkGraph({
      clinicianId: context.params.id,
    });

    return NextResponse.json(graph);
  } catch (error) {
    console.warn('Falling back to mock payer network graph', error);
    const mockGraph = buildMockGraph(context.params.id);
    return NextResponse.json(mockGraph, {
      headers: {
        'x-demo-data': 'true',
      },
    });
  }
}

function buildMockGraph(clinicianId: string) {
  const now = new Date();
  const enrollments: GraphEnrollmentSnapshot[] = [
    {
      enrollment: {
        id: 'mock-uhc',
        clinicianId,
        payerId: 'mock-uhc',
        status: 'ENROLLED',
        panelType: 'OPEN',
        effectiveDate: now,
        notes: null,
        metadata: null,
        lastStatusChange: now,
        createdAt: now,
        updatedAt: now,
      },
      payer: {
        id: 'mock-uhc',
        payerId: 'UHC',
        name: 'UnitedHealthcare',
        planTypes: ['PPO', 'HMO'],
        enrollmentEndpoint: null,
        x12SubmitEndpoint: null,
        contactInfo: null,
        requiresCaqh: true,
        requiresPecos: true,
        specialty: [],
        states: ['CA', 'TX', 'WA'],
        metadata: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      enrollment: {
        id: 'mock-blue',
        clinicianId,
        payerId: 'mock-blue',
        status: 'REVALIDATION_DUE',
        panelType: 'LIMITED',
        effectiveDate: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000),
        notes: 'Medicare advantage panel up for renewal',
        metadata: null,
        lastStatusChange: now,
        createdAt: now,
        updatedAt: now,
      },
      payer: {
        id: 'mock-blue',
        payerId: 'BLUE_CA',
        name: 'Blue Shield of California',
        planTypes: ['Medicare Advantage'],
        enrollmentEndpoint: null,
        x12SubmitEndpoint: null,
        contactInfo: null,
        requiresCaqh: true,
        requiresPecos: true,
        specialty: [],
        states: ['CA'],
        metadata: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  ];

  return buildPayerNetworkGraph({
    clinicianId,
    enrollments,
  });
}

