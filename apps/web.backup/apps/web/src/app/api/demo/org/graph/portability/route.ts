import { NextResponse } from 'next/server';
import { getCredentialPortability } from 'services/graph/credential/portability';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const clinicianId = searchParams.get('clinicianId') ?? 'demo-clinician';

  try {
    const payload = await getCredentialPortability({ clinicianId });
    return NextResponse.json(payload);
  } catch (error) {
    console.warn('Falling back to mock credential portability payload', error);
    return NextResponse.json(buildMockPortability(clinicianId), {
      headers: { 'x-demo-data': 'true' },
    });
  }
}

function buildMockPortability(clinicianId: string) {
  const now = new Date().toISOString();
  return {
    clinicianId,
    generatedAt: now,
    states: [
      {
        state: 'CA',
        nodeId: 'state:CA',
        confidence: 'high',
        score: 1,
        via: [
          { type: 'license', label: 'CA license', nodeId: 'license:ca', expiresAt: now },
        ],
        organizations: [
          {
            orgId: 'org-demo-1',
            name: 'Pacific Health',
            state: 'CA',
            ehrType: 'epic',
            privileges: [{ id: 'privilege:demo', label: 'Hospitalist Core', status: 'ACTIVE' }],
          },
        ],
        payers: [
          {
            payerId: 'UHC',
            name: 'UnitedHealthcare',
            enrollmentStatus: 'ENROLLED',
            planTypes: ['PPO'],
          },
        ],
      },
      {
        state: 'NV',
        nodeId: 'state:NV',
        confidence: 'medium',
        score: 0.75,
        via: [{ type: 'compact', label: 'IMLC compact', nodeId: 'compact:imlc' }],
        organizations: [],
        payers: [],
      },
    ],
    summary: {
      totalStates: 2,
      highConfidenceStates: 1,
      organizations: 1,
      payers: 1,
      warnings: 0,
    },
    warnings: [],
    graph: {
      metadata: {
        clinicianId,
        clinicianNodeId: `clinician:${clinicianId}`,
        generatedAt: now,
      },
      nodes: [
        { id: `clinician:${clinicianId}`, type: 'clinician', label: `Clinician ${clinicianId}` },
        { id: 'license:ca', type: 'license', label: 'CA license', status: 'ACTIVE' },
        { id: 'state:CA', type: 'state', label: 'CA', metadata: { code: 'CA' } },
        { id: 'state:NV', type: 'state', label: 'NV', metadata: { code: 'NV' } },
        { id: 'compact:imlc', type: 'compact', label: 'IMLC compact' },
      ],
      edges: [
        {
          id: 'edge:clinician->license:ca',
          source: `clinician:${clinicianId}`,
          target: 'license:ca',
          type: 'holds_license',
          active: true,
        },
        {
          id: 'edge:license:ca->state:CA',
          source: 'license:ca',
          target: 'state:CA',
          type: 'licensed_in',
          active: true,
        },
        {
          id: 'edge:clinician->compact:imlc',
          source: `clinician:${clinicianId}`,
          target: 'compact:imlc',
          type: 'member_of_compact',
          active: true,
        },
        {
          id: 'edge:compact:imlc->state:NV',
          source: 'compact:imlc',
          target: 'state:NV',
          type: 'compact_extends_to',
          active: true,
        },
      ],
      warnings: [],
      issues: [],
    },
  };
}

