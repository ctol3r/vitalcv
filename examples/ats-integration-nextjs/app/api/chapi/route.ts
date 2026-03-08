/**
 * CHAPI Payload Ingestion
 *
 * Accepts CHAPI VerifiablePresentation payloads from clinician wallets.
 * Extracts credentials and maps them to ATS candidate records.
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Types ──────────────────────────────────────────────────────────────

interface ChapiCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
}

interface ChapiPresentation {
  type: string;
  holder: string;
  verifiableCredential: ChapiCredential[];
  proof?: Record<string, unknown>;
}

// ── In-memory store (replace with your database) ───────────────────────

interface CandidateRecord {
  npi: string;
  credentials: Array<{
    credentialId: string;
    issuer: string;
    issuedAt: string;
    type: string;
  }>;
  ingestedAt: string;
}

const candidates = new Map<string, CandidateRecord>();

export async function POST(req: NextRequest) {
  try {
    const presentation = (await req.json()) as ChapiPresentation;

    if (presentation.type !== 'VerifiablePresentation') {
      return NextResponse.json(
        { error: 'Expected VerifiablePresentation type' },
        { status: 400 },
      );
    }

    // Extract NPI from holder DID
    const holderDid = presentation.holder ?? '';
    const npi = holderDid.replace('did:npi:', '');

    if (!npi) {
      return NextResponse.json({ error: 'Missing holder NPI' }, { status: 400 });
    }

    // Map credentials to ATS records
    const mappedCredentials = presentation.verifiableCredential.map((vc) => ({
      credentialId: vc.id,
      issuer: vc.issuer,
      issuedAt: vc.issuanceDate,
      type: vc.type.find((t) => t !== 'VerifiableCredential') ?? 'unknown',
    }));

    const record: CandidateRecord = {
      npi,
      credentials: mappedCredentials,
      ingestedAt: new Date().toISOString(),
    };

    candidates.set(npi, record);

    console.log(`[CHAPI Ingestion] ${mappedCredentials.length} credentials for NPI ${npi}`);

    return NextResponse.json({
      success: true,
      npi,
      credentialsIngested: mappedCredentials.length,
      ingestedAt: record.ingestedAt,
    });
  } catch (err) {
    console.error('CHAPI ingestion error:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function GET() {
  const records = Array.from(candidates.values());
  return NextResponse.json({
    candidates: records,
    total: records.length,
  });
}
