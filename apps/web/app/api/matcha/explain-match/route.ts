/**
 * POST /api/matcha/explain-match — an OPTIONAL AI "why this role fits you" note.
 *
 * Body: { opportunity, matchBand?, fitReasons?, blockers?, profileSummary? }
 * Returns: { summary } on success, { configured: false } when no ANTHROPIC_API_KEY
 * is set (honest — the UI keeps the deterministic reasons), or { error }.
 *
 * The note is grounded ONLY in the deterministic engine's fit signals + the
 * clinician's self-stated summary (see lib/matcha/matchExplanation.ts). It is an
 * enhancement layer over the source-honest scores — it never fabricates a score,
 * credential, or guarantee, and it is fully inert without a key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkAiLimit } from '@/lib/ai/rateLimit';
import { CLINICIAN_TIER_MESSAGE, userMeetsTier } from '@/lib/auth/clinicianTier';
import {
  buildMatchExplanationMessages,
  type MatchExplanationInput,
} from '@/lib/matcha/matchExplanation';
import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  anthropicModel,
  getAnthropicKey,
} from '@/lib/ai/anthropic';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    // Honest: AI isn't wired up here — the UI keeps the deterministic reasons.
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  // Guardrails: AI costs real money per call — require a signed-in user and
  // enforce per-user + global caps BEFORE any model call. The UI only shows AI
  // affordances to signed-in users; this closes the direct-POST path.
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Sign in to use AI features.' }, { status: 401 });
  }
  const limit = checkAiLimit(session.userId);
  if (!limit.ok) {
    return NextResponse.json({ error: limit.reason }, { status: 429 });
  }
  // Clinician-only power: requires the work_email_confirmed identity tier
  // (fail-closed if the identity state can't be read).
  if (!(await userMeetsTier(session.userId, 'work_email_confirmed'))) {
    return NextResponse.json({ error: CLINICIAN_TIER_MESSAGE }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<MatchExplanationInput>;
  const { system, user } = buildMatchExplanationMessages({
    opportunity: body.opportunity ?? {},
    matchBand: body.matchBand,
    fitReasons: body.fitReasons,
    blockers: body.blockers,
    profileSummary: body.profileSummary,
  });

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: anthropicModel(),
        max_tokens: 320,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'The explanation service is unavailable right now.' }, { status: 502 });
    }

    const data = (await res.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
    };

    if (data.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'Could not summarize this match.' }, { status: 200 });
    }

    const summary = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
      .trim();

    if (!summary) {
      return NextResponse.json({ error: 'No summary was produced.' }, { status: 200 });
    }

    return NextResponse.json({ summary }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Could not reach the explanation service.' }, { status: 502 });
  }
}
