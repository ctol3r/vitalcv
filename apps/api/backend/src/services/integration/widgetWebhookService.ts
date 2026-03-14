import { createHmac } from 'node:crypto';
import { log } from '../../obs/logger';

const FETCH_TIMEOUT_MS = 5_000;

export type WidgetWebhookEvent =
  | 'candidate.shared'
  | 'passport.verified'
  | 'trust_state.ready';

export interface WidgetWebhookEnvelope<TPayload> {
  schema: 'vitalcv.widget.event.v1';
  event: WidgetWebhookEvent;
  issued_at: string;
  payload: TPayload;
}

export interface WebhookDeliveryResult {
  delivered: boolean;
  status?: number;
}

export async function emitWidgetEvent<TPayload>(
  event: WidgetWebhookEvent,
  payload: TPayload,
  webhookUrl?: string | null,
  secret?: string | null,
): Promise<WebhookDeliveryResult> {
  if (!webhookUrl || !secret) {
    return { delivered: false };
  }

  const envelope: WidgetWebhookEnvelope<TPayload> = {
    schema: 'vitalcv.widget.event.v1',
    event,
    issued_at: new Date().toISOString(),
    payload,
  };
  const body = JSON.stringify(envelope);
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VitalCV-Signature': `sha256=${signature}`,
        'X-VitalCV-Event': event,
        'User-Agent': 'VitalCV-Widget/2.0',
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      log('warn', 'widget_webhook_delivery_failed', {
        event,
        webhookUrl,
        status: response.status,
      });
      return {
        delivered: false,
        status: response.status,
      };
    }

    return {
      delivered: true,
      status: response.status,
    };
  } catch (error) {
    log('warn', 'widget_webhook_delivery_failed', {
      event,
      webhookUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return { delivered: false };
  }
}
