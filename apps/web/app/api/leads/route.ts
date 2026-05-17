import 'server-only';

import { NextResponse } from 'next/server';

import {
  checkRateLimit,
  hashIp,
  persistLead,
  truncateUserAgent,
  validateLeadInput,
} from '@/lib/leads/persistLead';
import { deliverLeadToSlack } from '@/lib/leads/slack';

/**
 * POST /api/leads — public lead capture endpoint for /launch and
 * /demo/employer surfaces.
 *
 * Behavior:
 *   - Validates payload via validateLeadInput (email + intent + length-
 *     bounded optional fields).
 *   - Rate-limits by hashed caller IP (3 submissions / 5 min). On
 *     breach returns 429 + Retry-After.
 *   - Persists the cleaned row to a JSONL append at
 *     $LEAD_LOG_PATH (or ~/.vitalcv-logs/leads.jsonl).
 *   - Best-effort Slack delivery when SLACK_LEAD_CAPTURE_WEBHOOK_URL is
 *     set. Delivery failure does NOT fail the request — the lead is
 *     already persisted.
 *   - Never accepts credentials, PHI, or compliance-overclaim copy.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function extractClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '0.0.0.0';
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    );
  }

  const validation = validateLeadInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 400 },
    );
  }

  const rawIp = extractClientIp(request);
  const ipHash = hashIp(rawIp);
  const userAgentTrunc = truncateUserAgent(request.headers.get('user-agent'));

  const rate = checkRateLimit(ipHash);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds },
      {
        status: 429,
        headers: rate.retryAfterSeconds
          ? { 'Retry-After': String(rate.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const persisted = await persistLead({
    ...validation.value,
    ipHash,
    userAgentTrunc,
  });

  console.info(
    JSON.stringify({
      event: 'lead_captured',
      ts: persisted.createdAt,
      leadId: persisted.leadId,
      intent: persisted.intent,
      source: persisted.source ?? null,
    }),
  );

  const slack = await deliverLeadToSlack(persisted);

  return NextResponse.json(
    {
      ok: true,
      leadId: persisted.leadId,
      persisted: true,
      slackDelivered: slack.delivered,
      slackReason: slack.delivered ? null : slack.reason,
      createdAt: persisted.createdAt,
    },
    { status: 200 },
  );
}
