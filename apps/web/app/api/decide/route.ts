import { NextResponse, type NextRequest } from 'next/server';
import { makeDecision, verifyForEmployer } from '@domain/qia';
import type { RevocationRecord } from '@domain/credentials';
import { buildGoldenPathState } from '@/lib/golden-path';
import { resolveShareRecord } from '@/app/api/_golden-path/shareStore';

const DECISION_MODEL = { name: 'GoldenPathRules', version: '0.1.0' } as const;
const RULES_VERSION = 'golden-path-v1';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tokenInput = body?.token;
    if (!tokenInput || typeof tokenInput !== 'string') {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    let token = tokenInput;
    try {
      token = decodeURIComponent(tokenInput);
    } catch {
      return NextResponse.json({ error: 'Share token is invalid' }, { status: 400 });
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
    const decision = makeDecision({
      token: share.token,
      verification,
      intent: state.qia.intent,
      model: DECISION_MODEL,
      rules_version: RULES_VERSION,
      ledger_root: `ledger:${share.token.token_id}`,
      now,
    });

    return NextResponse.json({
      decision: decision.outcome,
      reasons: decision.blockers,
      receipt: {
        capsuleId: decision.capsule.capsule_id,
        decidedAt: decision.capsule.decision_at.toISOString(),
        model: decision.capsule.model,
        rulesVersion: decision.capsule.rules_version,
        ledgerRoot: decision.capsule.ledger_root,
      },
    });
  } catch (error) {
    console.error('Decision error:', error);
    return NextResponse.json({ error: 'Unable to make decision' }, { status: 500 });
  }
}
