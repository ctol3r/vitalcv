/**
 * GET /api/ai/status — is optional AI enabled in this environment?
 *
 * Lets the client show AI affordances (match summaries, cover-letter drafting)
 * ONLY when a model key is configured, so nothing dead appears in prod when AI
 * is off. Returns just a boolean — never the key.
 */

import { NextResponse } from 'next/server';
import { isAnthropicConfigured } from '@/lib/ai/anthropic';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({ enabled: isAnthropicConfigured() }, { status: 200 });
}
