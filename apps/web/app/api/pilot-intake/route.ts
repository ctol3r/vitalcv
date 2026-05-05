import 'server-only';

import { NextResponse } from 'next/server';

import { validatePilotIntake } from '@/lib/pilot-intake/validate';
import { deliverPilotIntakeToSlack } from '@/lib/pilot-intake/slack';

/**
 * POST /api/pilot-intake — pilot inquiry submission endpoint.
 *
 * Behavior:
 *   - Validates input via the pure helper.
 *   - Always logs the intake to server stdout so a fallback paper
 *     trail exists even when no destination is configured.
 *   - Delivers to Slack when SLACK_PILOT_INTAKE_WEBHOOK_URL is set.
 *   - Returns 400 + per-field errors on validation failure, 200 +
 *     delivery status on success. Never throws to the client.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const validation = validatePilotIntake(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 400 },
    );
  }

  const intake = validation.value;

  // Always log so an operator can grep the logs as a fallback paper
  // trail even when no Slack/DB destination is wired.
  console.info(
    JSON.stringify({
      event: 'pilot_intake_received',
      ts: new Date().toISOString(),
      persona: intake.persona,
      organization: intake.organization,
      // Email is logged to support follow-up; treat operator log
      // access as already privileged.
      email: intake.email,
    }),
  );

  const slack = await deliverPilotIntakeToSlack(intake);

  return NextResponse.json(
    {
      ok: true,
      slackDelivered: slack.delivered,
      slackReason: slack.delivered ? null : slack.reason,
    },
    { status: 200 },
  );
}
