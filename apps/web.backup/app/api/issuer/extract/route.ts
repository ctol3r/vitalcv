/**
 * Issuer OCR Extraction API
 * POST - Extract credential data from document using AI/OCR
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileUrl, credentialType, preview } = body;

    if (!fileUrl || !credentialType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (preview && isGarbagePreview(preview)) {
      return NextResponse.json(
        {
          route: 'hitl',
          manualReview: true,
          confidence: 0.05,
          reason: 'Unparseable OCR preview',
        },
        { status: 202 },
      );
    }

    // TODO: Implement actual OCR extraction
    // Call AI service (OpenAI, Azure Computer Vision, etc.)
    // For now, return mock extracted data
    const mockExtractedData = {
      confidence: 0.92,
      subjectId: 'did:example:holder-' + Math.random().toString(36).substring(7),
      claims:
        credentialType === 'MedicalLicense'
          ? {
              licenseNumber: 'CA-' + Math.floor(Math.random() * 100000),
              specialty: 'Internal Medicine',
              npi: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
              firstName: 'John',
              lastName: 'Doe',
              issueDate: new Date().toISOString().split('T')[0],
              status: 'Active',
            }
          : {
              certificationNumber: 'CERT-' + Math.floor(Math.random() * 100000),
              certificationDate: new Date().toISOString().split('T')[0],
              specialty: 'Internal Medicine',
            },
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
    };

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return NextResponse.json(mockExtractedData);
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract data' }, { status: 500 });
  }
}

function isGarbagePreview(preview: string): boolean {
  const normalized = preview.replace(/\s+/g, '');
  if (normalized.length < 20) {
    return true;
  }
  const alphaRatio =
    (normalized.match(/[A-Za-z]/g)?.length ?? 0) / Math.max(normalized.length, 1);
  return alphaRatio < 0.35;
}
