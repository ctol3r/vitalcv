/**
 * networkGateway.ts — Wave 91: Network Gateway + Webhook APIs
 *
 * POST /api/network/gateway/connect     — Generate gateway token
 * GET  /api/network/gateway/connections — List connected orgs
 * POST /api/network/webhooks/register   — Register webhook
 * POST /api/network/webhooks/test       — Test webhook delivery
 * GET  /api/network/webhooks            — List webhook subscriptions
 */

import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { generateGatewayToken } from '../services/network/gateway';
import { gatewayRegistry } from '../services/network/gatewayRegistry';
import { webhookDispatcher, type WebhookEvent } from '../services/network/webhookDispatcher';
import { sha256Hex } from '../utils/deterministic';
import { log } from '../obs/logger';

const VALID_EVENTS: WebhookEvent[] = ['credential_verified', 'credential_revoked', 'decision_created', 'trust_state_changed'];

export function registerNetworkGatewayRoutes(app: Express): void {
  // Generate gateway token for an organization
  app.post('/api/network/gateway/connect', (req: Request, res: Response) => {
    try {
      const { organizationId, organizationName, type } = req.body ?? {};
      if (!organizationId || typeof organizationId !== 'string') {
        res.status(400).json({ error: 'organizationId is required' });
        return;
      }

      const token = generateGatewayToken(organizationId, organizationName, type);
      res.json(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'gateway_connect: failed', { error: message });
      res.status(500).json({ error: 'Failed to generate gateway token' });
    }
  });

  // List connected organizations
  app.get('/api/network/gateway/connections', (_req: Request, res: Response) => {
    const connections = gatewayRegistry.listAll().map((org) => ({
      id: org.id,
      name: org.name,
      type: org.type,
      status: org.status,
      connectedAt: org.connectedAt,
      lastActivity: org.lastActivity,
      permissions: org.permissions,
    }));
    res.json({ connections, total: connections.length });
  });

  // Register webhook subscription
  app.post('/api/network/webhooks/register', (req: Request, res: Response) => {
    try {
      const { organizationId, url, events } = req.body ?? {};

      if (!organizationId || typeof organizationId !== 'string') {
        res.status(400).json({ error: 'organizationId is required' });
        return;
      }
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'url is required' });
        return;
      }
      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ error: 'events array is required', validEvents: VALID_EVENTS });
        return;
      }

      const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}`, validEvents: VALID_EVENTS });
        return;
      }

      const secret = sha256Hex(`${organizationId}:${randomUUID()}`).slice(0, 32);
      const subscription = webhookDispatcher.register({
        id: randomUUID(),
        organizationId,
        url,
        events: events as WebhookEvent[],
        secret,
        createdAt: new Date().toISOString(),
      });

      res.json({
        subscription: {
          id: subscription.id,
          url: subscription.url,
          events: subscription.events,
          active: subscription.active,
          createdAt: subscription.createdAt,
        },
        secret,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'webhook_register: failed', { error: message });
      res.status(500).json({ error: 'Failed to register webhook' });
    }
  });

  // Test webhook delivery
  app.post('/api/network/webhooks/test', async (req: Request, res: Response) => {
    try {
      const { subscriptionId } = req.body ?? {};
      if (!subscriptionId || typeof subscriptionId !== 'string') {
        res.status(400).json({ error: 'subscriptionId is required' });
        return;
      }

      const result = await webhookDispatcher.testDelivery(subscriptionId);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'webhook_test: failed', { error: message });
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  });

  // List all webhook subscriptions
  app.get('/api/network/webhooks', (_req: Request, res: Response) => {
    const subscriptions = webhookDispatcher.listAll().map((s) => ({
      id: s.id,
      organizationId: s.organizationId,
      url: s.url,
      events: s.events,
      active: s.active,
      lastDelivery: s.lastDelivery,
      deliveryCount: s.deliveryCount,
      failureCount: s.failureCount,
      createdAt: s.createdAt,
    }));
    res.json({ subscriptions, total: subscriptions.length });
  });
}
