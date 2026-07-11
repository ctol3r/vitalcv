/**
 * POST /api/matcha/cover-letter — generate an AI cover-letter DRAFT for an opportunity.
 *
 * Body: { opportunity: {title, organization, specialty, location}, profileSummary: string }
 * Returns: { draft } on success, { configured: false } when no model key is set (honest —
 * the UI shows an "AI drafting isn't enabled here" state rather than failing), or { error }.
 *
 * Calls the Anthropic Messages API directly (no SDK dependency). Model defaults to
 * claude-opus-4-8; override with COVER_LETTER_MODEL. The draft is grounded only in the provided
 * facts (see lib/matcha/coverLetter.ts) and is clearly labeled AI-generated in the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildCoverLetterMessages, type CoverLetterOpportunity } from '@/lib/matcha/coverLetter';
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
    // Honest: AI isn't wired up in this environment (no ANTHROPIC_API_KEY).
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    opportunity?: CoverLetterOpportunity;
    profileSummary?: string;
  };
  const opportunity = body.opportunity ?? {};
  const profileSummary = typeof body.profileSummary === 'string' ? body.profileSummary : '';

  const { system, user } = buildCoverLetterMessages({ profileSummary, opportunity });

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
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'The drafting service is unavailable right now.' }, { status: 502 });
    }

    const data = (await res.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
    };

    if (data.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'The model declined to draft this. Try adding a few more details to your profile.' },
        { status: 200 },
      );
    }

    const draft = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
      .trim();

    if (!draft) {
      return NextResponse.json({ error: 'No draft was produced. Please try again.' }, { status: 200 });
    }

    return NextResponse.json({ draft }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Could not reach the drafting service. Please try again.' }, { status: 502 });
  }
}
