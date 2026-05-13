import 'server-only';

import type { PilotIntakeInput } from './validate';

/**
 * Slack webhook wrapper for pilot intake.
 *
 * Behavior:
 *   - If SLACK_PILOT_INTAKE_WEBHOOK_URL is unset, this is a no-op
 *     and returns { delivered: false, reason: 'unconfigured' }.
 *   - If set, posts a Slack-formatted message and returns
 *     { delivered: true } on 2xx, { delivered: false, reason }
 *     on any other outcome.
 *   - Never throws — any network error degrades to a delivery
 *     failure outcome so the caller can still log the intake row
 *     without the page crashing.
 */

export type SlackDeliveryOutcome =
  | { delivered: true }
  | { delivered: false; reason: 'unconfigured' | 'http_error' | 'fetch_failed' };

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL);
}

export async function deliverPilotIntakeToSlack(
  intake: PilotIntakeInput,
  webhookUrl: string | undefined = process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL,
): Promise<SlackDeliveryOutcome> {
  if (!webhookUrl) return { delivered: false, reason: 'unconfigured' };

  const message = {
    text: `New VitalCV pilot inquiry: ${intake.fullName} (${intake.organization}, ${intake.persona})`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `New pilot inquiry — ${intake.persona}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Name*\n${intake.fullName}` },
          { type: 'mrkdwn', text: `*Email*\n${intake.email}` },
          { type: 'mrkdwn', text: `*Org*\n${intake.organization}` },
          { type: 'mrkdwn', text: `*Persona*\n${intake.persona}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Description*\n${intake.description}` },
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!res.ok) return { delivered: false, reason: 'http_error' };
    return { delivered: true };
  } catch {
    return { delivered: false, reason: 'fetch_failed' };
  }
}
