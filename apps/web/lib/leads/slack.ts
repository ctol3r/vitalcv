import 'server-only';

import type { PersistedLead } from './persistLead';

/**
 * Slack webhook wrapper for lead capture.
 *
 * Behavior mirrors lib/pilot-intake/slack.ts:
 *   - If SLACK_LEAD_CAPTURE_WEBHOOK_URL is unset, no-op and returns
 *     { delivered: false, reason: 'unconfigured' }.
 *   - On 2xx, returns { delivered: true }. On any other outcome,
 *     returns a non-throwing failure so the caller can still log the
 *     lead row.
 */

export type SlackDeliveryOutcome =
  | { delivered: true }
  | { delivered: false; reason: 'unconfigured' | 'http_error' | 'fetch_failed' };

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_LEAD_CAPTURE_WEBHOOK_URL);
}

export async function deliverLeadToSlack(
  lead: PersistedLead,
  webhookUrl: string | undefined = process.env.SLACK_LEAD_CAPTURE_WEBHOOK_URL,
): Promise<SlackDeliveryOutcome> {
  if (!webhookUrl) return { delivered: false, reason: 'unconfigured' };

  // Only sanitized fields cross the Slack boundary. No raw free-text
  // message. No raw npiList. The sampleNpis array is already bounded
  // and digit-only (validated in persistLead.sanitizeNpiList), so it is
  // safe to surface for triage.
  const fields: Array<{ type: 'mrkdwn'; text: string }> = [
    { type: 'mrkdwn', text: `*Intent*\n${lead.intent}` },
    { type: 'mrkdwn', text: `*Email*\n${lead.email}` },
    { type: 'mrkdwn', text: `*Lead*\n${lead.leadId}` },
    { type: 'mrkdwn', text: `*Source*\n${lead.source ?? '(unset)'}` },
    { type: 'mrkdwn', text: `*Sample NPIs*\n${lead.sampleNpiCount}` },
  ];

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `New VitalCV lead — ${lead.intent}` },
    },
    { type: 'section', fields },
  ];

  if (lead.sampleNpis && lead.sampleNpis.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Sample NPI list (${lead.sampleNpis.length})*\n${lead.sampleNpis.join(', ')}`,
      },
    });
  }

  const message = {
    text: `New VitalCV lead (${lead.intent}): ${lead.email}`,
    blocks,
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
