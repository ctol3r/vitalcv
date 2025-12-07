import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payer/enrollments/draft - Start enrollment draft with prepopulated data
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { payerId, clinicianNpi } = body;

  // Mock prepopulated data from CAQH and VitalCV
  const draftData = {
    payerId,
    clinicianNpi,
    productLines: ['medical'], // Default suggestion

    prepopulated: {
      fromCaqh: {
        attestationDate: '2024-11-01T10:00:00Z',
        demographics: {
          name: 'Dr. Sarah Johnson',
          npi: clinicianNpi,
        },
        licenses: [
          { state: 'CA', number: 'A123456', status: 'active' },
          { state: 'NY', number: 'NY987654', status: 'active' }
        ],
        certifications: [
          { name: 'Board Certified - Internal Medicine', year: 2020 }
        ]
      },
      fromVitalCV: {
        credentials: ['vc_lic_ca_001', 'vc_cert_board_001'],
        licenses: [
          { state: 'CA', verified: true }
        ],
        certifications: [
          { type: 'board', specialty: 'Internal Medicine', verified: true }
        ]
      }
    },

    missingItems: [
      {
        field: 'effectiveDate',
        label: 'Desired Effective Date',
        required: true,
        type: 'date'
      },
      {
        field: 'practiceAddress',
        label: 'Practice Address',
        required: true,
        type: 'text'
      },
      {
        field: 'taxId',
        label: 'Tax ID (EIN)',
        required: true,
        type: 'text'
      }
    ],

    requiredDocuments: [
      'w9',
      'coi'
    ]
  };

  return NextResponse.json(draftData);
}

