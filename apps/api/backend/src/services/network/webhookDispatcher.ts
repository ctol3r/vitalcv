/**
 * webhookDispatcher.ts — Wave 91: Webhook Dispatcher
 *
 * Manages webhook subscriptions and dispatches events
 * to connected organizations.
 */

import { log } from '../../obs/logger';
import { gatewayRegistry } from './gatewayRegistry';

// ── Types ─────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'credential_verified'
  | 'credential_revoked'
  | 'decision_created'
  | 'trust_state_changed';

export interface WebhookSubscription {
  id: string;
  organizationId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdAt: string;
  lastDelivery: string | null;
  deliveryCount: number;
  failureCount: number;
}

export interface WebhookDelivery {
  event: WebhookEvent;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ── Dispatcher ────────────────────────────────────────────────────────

class WebhookDispatcher {
  private subscriptions = new Map<string, WebhookSubscription>();
  private deliveryLog: Array<{ subscriptionId: string; event: WebhookEvent; status: 'sent' | 'failed'; timestamp: string }> = [];

  register(sub: Omit<WebhookSubscription, 'active' | 'lastDelivery' | 'deliveryCount' | 'failureCount'>): WebhookSubscription {
    const full: WebhookSubscription = {
      ...sub,
      active: true,
      lastDelivery: null,
      deliveryCount: 0,
      failureCount: 0,
    };
    this.subscriptions.set(sub.id, full);
    log('info', 'webhook_dispatcher: registered', { id: sub.id, events: sub.events });
    return full;
  }

  getByOrganization(organizationId: string): WebhookSubscription[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.organizationId === organizationId);
  }

  listAll(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  async dispatch(event: WebhookEvent, payload: Record<string, unknown>): Promise<number> {
    const matching = Array.from(this.subscriptions.values()).filter(
      (s) => s.active && s.events.includes(event),
    );

    let sent = 0;
    for (const sub of matching) {
      try {
        // In production, this would POST to sub.url
        // For now, log the dispatch and update counters
        sub.deliveryCount++;
        sub.lastDelivery = new Date().toISOString();
        this.deliveryLog.push({
          subscriptionId: sub.id,
          event,
          status: 'sent',
          timestamp: sub.lastDelivery,
        });

        // Track activity in gateway registry
        gatewayRegistry.recordActivity(sub.organizationId);
        sent++;
      } catch {
        sub.failureCount++;
        this.deliveryLog.push({
          subscriptionId: sub.id,
          event,
          status: 'failed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    log('info', 'webhook_dispatcher: dispatched', { event, matching: matching.length, sent });
    return sent;
  }

  async testDelivery(subscriptionId: string): Promise<{ success: boolean; message: string }> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return { success: false, message: 'Subscription not found' };

    // Simulate a test delivery
    sub.deliveryCount++;
    sub.lastDelivery = new Date().toISOString();
    this.deliveryLog.push({
      subscriptionId,
      event: 'credential_verified',
      status: 'sent',
      timestamp: sub.lastDelivery,
    });

    log('info', 'webhook_dispatcher: test delivery', { subscriptionId });
    return { success: true, message: 'Test webhook delivered successfully' };
  }

  getRecentDeliveries(limit: number = 20): typeof this.deliveryLog {
    return this.deliveryLog.slice(-limit);
  }
}

export const webhookDispatcher = new WebhookDispatcher();
