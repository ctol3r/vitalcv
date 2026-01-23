import { NextResponse, type NextRequest } from 'next/server';
import { verifyForEmployer } from '@domain/qia';
import type { RevocationRecord } from '@domain/credentials';
import { buildGoldenPathState } from '@/lib/golden-path';
import { resolveShareRecord } from '@/app/api/_golden-path/shareStore';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const tokenParam = params?.token;
    let token = '';
    if (typeof tokenParam === 'string') {
      try {
        token = decodeURIComponent(tokenParam);
      } catch {
        return NextResponse.json({ error: 'Share token is invalid' }, { status: 400 });
      }
    }
    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const now = new Date();
    const share = resolveShareRecord(token, now);
    if (!share) {
      return NextResponse.json({ error: 'Share token is invalid or expired' }, { status: 404 });
    }

    const state = buildGoldenPathState({
      scenario: share.scenario,
      now,
      holderId: share.token.holder_id,
    });
    const revocationRecords = new Map<string, RevocationRecord>();
    if (state.credentialValidity.revocation) {
      revocationRecords.set(
        state.credentialValidity.credential_id,
        state.credentialValidity.revocation,
      );
    }

    const verification = verifyForEmployer({
      token: share.token,
      credentials: [state.credential],
      revocation_records: revocationRecords,
      authority_snapshot: state.authoritySnapshot,
      trust_gradient: state.trustGradient,
      now,
    });

    const claims = state.credential.subject.claims;
    const holderName = typeof claims.full_name === 'string' ? claims.full_name : 'Clinician';
    const holderNpi = typeof claims.npi === 'string' ? claims.npi : 'Unknown';

    return NextResponse.json({
      token: verification.token_id,
      verifiedAt: verification.verified_at.toISOString(),
      holder: {
        id: verification.holder_id,
        name: holderName,
        npi: holderNpi,
      },
      freshness: state.qia.freshness.proven_at.toISOString(),
      credentials: verification.credentials.map((credential) => ({
        id: credential.credential_id,
        type: credential.type,
        issuer: state.credential.issuer,
        status: credential.status,
        validUntil: credential.valid_until?.toISOString(),
        checkedAt: credential.checked_at.toISOString(),
        reason: credential.reason,
      })),
      crs: {
        score: verification.crs.score,
        grade: verification.crs.grade,
        reasons: verification.crs.reasons.map((reason) => reason.message),
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Unable to verify shared package' }, { status: 500 });
  }
}
