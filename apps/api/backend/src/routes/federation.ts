/**
 * federation.ts — Wave 102: Network Federation API Routes
 *
 * POST /api/network/federate           — Register an external network
 * GET  /api/network/peers              — List federated peers
 * GET  /api/network/peers/:networkId   — Get a specific peer
 * PATCH /api/network/peers/:networkId/status — Update peer status
 */

import type { Express, Request, Response } from 'express';
import {
  registerExternalNetwork,
  listFederatedNetworks,
  getFederatedNetwork,
  updateNetworkStatus,
  type FederatedNetworkStatus,
  type FederatedNetworkType,
} from '../services/network/federation';
import { log } from '../obs/logger';
import { requireInternalSecret } from '../middleware/internalSecret';

/**
 * AUTHORIZATION (2026-08-08). `POST /api/network/federate` and
 * `PATCH /api/network/peers/:networkId/status` had no authorization beyond the
 * global tenant guard, which accepted the mere PRESENCE of a caller-supplied
 * `x-org-id`. Federation admin — establishing a peer relationship and flipping
 * a peer's status — was reachable anonymously with one header.
 *
 * Operator secret. The only caller of the PATCH was `FederationHealthPanel`,
 * which NO page imports; verifier-sdk calls the sibling GET /api/network/peers,
 * not this route, so the SDK is unaffected.
 */
export function registerFederationRoutes(app: Express): void {

  // ── POST /api/network/federate ─────────────────────────────────────
  app.post('/api/network/federate', requireInternalSecret, (req: Request, res: Response) => {
    try {
      const { networkName, endpoint, publicKey, networkType, didMethods, metadata } =
        req.body ?? {};

      const validTypes: FederatedNetworkType[] = [
        'credential_network',
        'licensing_authority',
        'hospital_system',
        'insurer',
        'government',
      ];

      if (!networkName || typeof networkName !== 'string') {
        res.status(400).json({ error: 'networkName is required' });
        return;
      }
      if (!endpoint || typeof endpoint !== 'string') {
        res.status(400).json({ error: 'endpoint is required' });
        return;
      }
      if (!networkType || !validTypes.includes(networkType)) {
        res.status(400).json({ error: `networkType must be one of ${validTypes.join(', ')}` });
        return;
      }

      const network = registerExternalNetwork({
        networkName,
        endpoint,
        publicKey: publicKey ?? '',
        networkType,
        didMethods: Array.isArray(didMethods) ? didMethods : [],
        metadata,
      });

      res.status(201).json({ network, message: 'Network registered as PENDING peer' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_register_failed', { error: msg });
      res.status(500).json({ error: 'Failed to register federated network', detail: msg });
    }
  });

  // ── GET /api/network/peers ─────────────────────────────────────────
  app.get('/api/network/peers', (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const networks = listFederatedNetworks(status as FederatedNetworkStatus | undefined);

      res.status(200).json({
        networks,
        total: networks.length,
        active: networks.filter((n) => n.status === 'ACTIVE').length,
        pending: networks.filter((n) => n.status === 'PENDING').length,
        retrievedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list federated networks', detail: msg });
    }
  });

  // ── GET /api/network/peers/:networkId ──────────────────────────────
  app.get('/api/network/peers/:networkId', (req: Request, res: Response) => {
    try {
      const { networkId } = req.params;
      const network = getFederatedNetwork(networkId);

      if (!network) {
        res.status(404).json({ error: `Federated network "${networkId}" not found` });
        return;
      }

      res.status(200).json({ network });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_get_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve federated network', detail: msg });
    }
  });

  // ── PATCH /api/network/peers/:networkId/status ─────────────────────
  app.patch('/api/network/peers/:networkId/status', requireInternalSecret, (req: Request, res: Response) => {
    try {
      const { networkId } = req.params;
      const { status, nodeCount, lastSyncAt } = req.body ?? {};

      const validStatuses: FederatedNetworkStatus[] = [
        'ACTIVE',
        'PENDING',
        'SUSPENDED',
        'DISCONNECTED',
      ];

      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: `status must be one of ${validStatuses.join(', ')}` });
        return;
      }

      const syncMeta =
        nodeCount !== undefined && lastSyncAt
          ? { nodeCount: Number(nodeCount), lastSyncAt }
          : undefined;

      const updated = updateNetworkStatus(networkId, status as FederatedNetworkStatus, syncMeta);
      if (!updated) {
        res.status(404).json({ error: `Federated network "${networkId}" not found` });
        return;
      }

      res.status(200).json({ network: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_status_update_failed', { error: msg });
      res.status(500).json({ error: 'Failed to update network status', detail: msg });
    }
  });
}
