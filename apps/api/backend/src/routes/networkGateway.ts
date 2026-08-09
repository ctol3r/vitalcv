/**
 * networkGateway.ts — Wave 91 + 96: Network Gateway + Webhook APIs
 *
 * SERVED:
 *   GET  /api/network/global              — Wave 96: Global trust network graph
 *
 * NOT SERVED (see "Unwired scaffold" below):
 *   POST /api/network/gateway/connect     — Generate gateway token
 *   POST /api/network/webhooks/register   — Register webhook
 *   POST /api/network/webhooks/test       — Test webhook delivery
 *   GET  /api/network/webhooks            — List webhook subscriptions
 *   GET  /api/network/gateway/connections — List connected orgs
 *
 * ── Why the one read stays reachable ────────────────────────────────────────
 * `/global` has a real consumer and is an aggregate platform view, not
 * per-tenant data. The graph's clinician nodes carry only an NPI and a label,
 * both of which are public NPPES facts; the trust metrics on it belong to issuer
 * nodes, and it contains no acceptance edges, so it does not reveal which
 * employer engaged which clinician. Keeping it public was an explicit decision
 * (2026-07-28), not an oversight — if that changes, it needs identity forwarding
 * added to its caller in the same change, or the institutions map breaks.
 *
 * That caller is `apps/web/app/api/map/institutions/route.ts`, a served Next
 * route handler that fetches this route to build the map layer. #962 also named
 * `GlobalTrustMap` and the ops `TrustGraphConsole`; re-checked 2026-08-09, both
 * are dead — `GlobalTrustMap` has zero importers, and every chain into
 * `TrustGraphConsole` terminates in `app/_archive`, which is unrouted. Neither
 * supports keeping anything reachable. The route handler does, on its own.
 *
 * ── Unwired scaffold ────────────────────────────────────────────────────────
 * The five routes above were registered with NO authentication of any kind.
 * `connect` minted a gateway token for any organization named in the body;
 * `webhooks/register` accepted an arbitrary org id and callback URL. Nothing in
 * the repository ever called any of them.
 *
 * They are unregistered rather than authenticated, on the same reasoning as
 * #947: the store behind them is a process-local Map (`gatewayRegistry`,
 * `webhookDispatcher`), nothing outside this module ever calls
 * `webhookDispatcher`, so a registered subscription is never dispatched — the
 * registry is write-only. Verified empty in production before removal:
 * `/gateway/connections` and `/webhooks` both returned `total: 0`.
 *
 * `/gateway/connections` was kept served by #962 on the stated grounds that it
 * "backs `GatewayConnections`". It did not: that component had ZERO importers —
 * it was mounted on no page and no layout, so the justification for keeping a
 * world-reachable unauthenticated route rested on a consumer that never
 * rendered. Its emptiness was structural, not incidental: the only writer to
 * `gatewayRegistry` is `services/network/gateway.ts`, which nothing imports, so
 * the read answered `{ total: 0 }` in every process, permanently. The component
 * is deleted in the same change that unregisters this route, because mounting it
 * would have shipped a panel that can only ever say "no organizations connected"
 * over copy pointing at `POST /api/network/gateway/connect` — 404 since #962.
 *
 * BEFORE RESTORING ANY OF THEM, all five must be true:
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
 *   5. Enumeration, again. `GET /api/network/gateway/connections` listed every
 *      connected organization platform-wide with its permission set. It was
 *      harmless only because the registry was always empty; the moment `connect`
 *      is restored it stops being harmless, so restore the two together and
 *      org-scope this one.
 *
 * A restored route also needs a MOUNTED consumer, not merely a component that
 * names it — that conflation is what kept this route served through #962.
 *
 * `routes/__tests__/networkGatewayScaffold.test.ts` fails if any of the five is
 * re-registered without this being revisited.
 */

import type { Express, Request, Response } from 'express';
import { generateGlobalGraph } from '../services/network/globalGraph';
import { log } from '../obs/logger';

export function registerNetworkGatewayRoutes(app: Express): void {
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
