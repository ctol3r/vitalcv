/**
 * Verifiable Presentation API
 * POST - Create a verifiable presentation from selected credentials and fields
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { credentialIds, selectedFields } = body;

    if (!credentialIds || !Array.isArray(credentialIds) || credentialIds.length === 0) {
      return NextResponse.json({ error: 'Invalid credential IDs' }, { status: 400 });
    }

    // TODO: Implement actual VP creation with selective disclosure
    // For now, return mock VP
    const presentation = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1',
      ],
      type: ['VerifiablePresentation'],
      verifiableCredential: credentialIds.map((id) => ({
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1',
        ],
        type: ['VerifiableCredential', 'MedicalLicense'],
        credentialSubject: {
          id: 'did:example:holder-123',
          // Include only selected fields
          ...(selectedFields && selectedFields[id]
            ? Object.fromEntries(
                selectedFields[id].map((field: string) => [field, `value-for-${field}`]),
              )
            : {}),
        },
        issuer: 'did:example:ca-medical-board',
        issuanceDate: '2023-01-15T10:00:00Z',
        proof: {
          type: 'Ed25519Signature2020',
          created: '2023-01-15T10:00:00Z',
          proofPurpose: 'assertionMethod',
          verificationMethod: 'did:example:ca-medical-board#key-1',
          proofValue: 'z3F...(mock signature)',
        },
      })),
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        proofPurpose: 'authentication',
        verificationMethod: 'did:example:holder-123#key-1',
        challenge: 'unique-challenge-' + Date.now(),
        proofValue: 'z5V...(mock presentation signature)',
      },
      selectedFields,
    };

    return NextResponse.json(presentation);
  } catch (error) {
    console.error('Error creating presentation:', error);
    return NextResponse.json({ error: 'Failed to create presentation' }, { status: 500 });
  }
}
