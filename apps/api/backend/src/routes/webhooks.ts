import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  createIntegrationWebhookSubscription,
  INTEGRATION_WEBHOOK_EVENT_TYPES,
  type IntegrationWebhookEventType,
} from '../services/integration/webhookSystem';

function requireMonitoringSecret(req: Request, res: Response): boolean {
  const secret = process.env.MONITORING_SECRET?.trim() ?? '';
  const provided = req.get('x-monitoring-secret')?.trim() ?? '';

  if (!secret || !provided || provided !== secret) {
    res.status(403).json({ error: 'Forbidden — X-Monitoring-Secret required.' });
    return false;
  }

  return true;
}

function readOrganizationId(req: Request): string | null {
  const fromHeader = req.get('x-organization-id')?.trim();
  if (fromHeader) {
    return fromHeader;
  }

  const body = req.body as { organizationId?: unknown } | undefined;
  if (typeof body?.organizationId === 'string' && body.organizationId.trim().length > 0) {
    return body.organizationId.trim();
  }

  return null;
}

export function registerWebhookRoutes(app: Express): void {
  app.post('/api/webhooks', async (req: Request, res: Response) => {
    if (!requireMonitoringSecret(req, res)) {
      return;
    }

    const body = (req.body ?? {}) as {
      url?: unknown;
      events?: unknown;
      signingSecret?: unknown;
      organizationId?: unknown;
    };

    if (typeof body.url !== 'string' || body.url.trim().length === 0) {
      return res.status(400).json({
        error: 'invalid_url',
        error_description: 'url must be a non-empty string.',
      });
    }

    const organizationId = readOrganizationId(req);

    try {
      const created = await createIntegrationWebhookSubscription({
        url: body.url,
        events: Array.isArray(body.events) ? body.events as IntegrationWebhookEventType[] : [],
        signingSecret: typeof body.signingSecret === 'string' ? body.signingSecret : null,
        organizationId,
      });

      return res.status(201).json({
        ok: true,
        webhook: created.subscription,
        signingSecret: created.signingSecret,
        supportedEvents: INTEGRATION_WEBHOOK_EVENT_TYPES,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      log('warn', 'integration_webhook_create_failed', {
        organizationId,
        message,
      });

      return res.status(400).json({
        error: 'invalid_webhook_subscription',
        error_description: message,
        supportedEvents: INTEGRATION_WEBHOOK_EVENT_TYPES,
      });
    }
  });
}
