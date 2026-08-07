/**
 * networkGateway.ts — Wave 91 + 96: Network Gateway + Webhook APIs
 *
 * SERVED:
 *   GET  /api/network/gateway/connections — List connected orgs
 *   GET  /api/network/global              — Wave 96: Global trust network graph
 *
 * NOT SERVED (see "Unwired scaffold" below):
 *   POST /api/network/gateway/connect     — Generate gateway token
 *   POST /api/network/webhooks/register   — Register webhook
 *   POST /api/network/webhooks/test       — Test webhook delivery
 *   GET  /api/network/webhooks            — List webhook subscriptions
 *
 * ── Why the two reads stay reachable ────────────────────────────────────────
 * Both have real consumers and both are aggregate platform views, not per-tenant
 * data: `/global` backs the institutions map, `GlobalTrustMap`, and the ops
 * `TrustGraphConsole`; `/gateway/connections` backs `GatewayConnections`. The
 * graph's clinician nodes carry only an NPI and a label, both of which are
 * public NPPES facts; the trust metrics on it belong to issuer nodes, and it
 * contains no acceptance edges, so it does not reveal which employer engaged
 * which clinician. Keeping them public was an explicit decision (2026-07-28),
 * not an oversight — if that changes, they need identity forwarding added to
 * those three web callers in the same change, or the surfaces break.
 *
 * ── Unwired scaffold ────────────────────────────────────────────────────────
 * The four routes above were registered with NO authentication of any kind.
 * `connect` minted a gateway token for any organization named in the body;
 * `webhooks/register` accepted an arbitrary org id and callback URL. Nothing in
 * the repository ever called any of them.
 *
 * They are unregistered rather than authenticated, on the same reasoning as
 * #947: the store behind them is a process-local Map (`gatewayRegistry`,
 * `webhookDispatcher`), nothing outside this module ever calls
 * `webhookDispatcher`, so a registered subscription is never dispatched — the
 * registry is write-only. Verified empty in production before removal:
 * `/gateway/connections` and `/webhooks` both returned `total: 0`. Removing
 * `connect` therefore changes nothing observable — `connections` was already
 * permanently empty, which is why `GatewayConnections` renders an empty state.
 *
 * BEFORE RESTORING ANY OF THEM, all four must be true:
 *   1. Authentication. Every one was world-reachable. `connect` is credential
 *      issuance and needs a platform-operator boundary (middleware/platformAdmin.ts),
 *      not a session.
 *   2. Ownership. `webhooks/register` took `organizationId` from the body, so a
 *      caller could subscribe to another org's events. Scope it to the caller's
 *      own org, resolved from the membership store — never from input.
 *   3. Egress control. The registered `url` is unvalidated. `testDelivery`
 *      currently only simulates and never fetches, so there is no SSRF today —
 *      but wiring a real dispatcher without an allowlist and a block on
 *      internal/link-local addresses creates one immediately.
 *   4. Enumeration. `GET /api/network/webhooks` listed every subscription
 *      across all orgs, including each callback URL. It must be org-scoped.
 *
 * `routes/__tests__/networkGatewayScaffold.test.ts` fails if any of the four is
 * re-registered without this being revisited.
 */

import type { Express, Request, Response } from 'express';
import { gatewayRegistry } from '../services/network/gatewayRegistry';
import { generateGlobalGraph } from '../services/network/globalGraph';
import { log } from '../obs/logger';

export function registerNetworkGatewayRoutes(app: Express): void {
  // List connected organizations — aggregate, no per-tenant data.
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

  // ── GET /api/network/global — Wave 96: Global Trust Network Graph ──
  app.get('/api/network/global', async (_req: Request, res: Response) => {
    try {
      const graph = await generateGlobalGraph();
      res.status(200).json(graph);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'global_graph_route_failed', { error: msg });
      res.status(500).json({ error: 'Failed to generate global trust network graph', detail: msg });
    }
  });
}
