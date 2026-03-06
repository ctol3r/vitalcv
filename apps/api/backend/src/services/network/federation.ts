/**
 * federation.ts — Wave 102: Network Federation
 *
 * Allows external credential networks to register as federated peers
 * with VitalCV. Federated networks expose nodes and edges that can be
 * included in the global trust graph.
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type FederatedNetworkStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISCONNECTED';
export type FederatedNetworkType = 'credential_network' | 'licensing_authority' | 'hospital_system' | 'insurer' | 'government';

export interface FederatedNetwork {
  /** Unique network identifier */
  networkId: string;
  /** Human-readable name */
  networkName: string;
  /** REST endpoint for credential/graph queries */
  endpoint: string;
  /** SPKI PEM public key for verifying responses */
  publicKey: string;
  /** Type of external network */
  networkType: FederatedNetworkType;
  /** Connection status */
  status: FederatedNetworkStatus;
  /** Supported DID methods this network uses */
  didMethods: string[];
  /** ISO-8601 registration timestamp */
  registeredAt: string;
  /** ISO-8601 last successful sync */
  lastSyncAt?: string;
  /** Node count from last sync */
  nodeCount?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface RegisterNetworkRequest {
  networkName: string;
  endpoint: string;
  publicKey: string;
  networkType: FederatedNetworkType;
  didMethods?: string[];
  metadata?: Record<string, unknown>;
}

// ── Storage ───────────────────────────────────────────────────────────

const networks = new Map<string, FederatedNetwork>();

// ── Seed federated peers ──────────────────────────────────────────────

const SEED_NETWORKS: Omit<FederatedNetwork, 'registeredAt'>[] = [
  {
    networkId: 'net-nursys',
    networkName: 'Nursys — Nurse Licensure Compact',
    endpoint: 'https://api.nursys.com/v2',
    publicKey: '',
    networkType: 'licensing_authority',
    status: 'PENDING',
    didMethods: ['did:web'],
    nodeCount: 0,
    metadata: { coverage: 'nursing', jurisdiction: 'US' },
  },
  {
    networkId: 'net-caqh',
    networkName: 'CAQH ProView',
    endpoint: 'https://proview.caqh.org/api',
    publicKey: '',
    networkType: 'credential_network',
    status: 'PENDING',
    didMethods: ['did:web'],
    nodeCount: 0,
    metadata: { coverage: 'physician_credentialing', jurisdiction: 'US' },
  },
];

for (const seed of SEED_NETWORKS) {
  networks.set(seed.networkId, {
    ...seed,
    registeredAt: '2025-06-01T00:00:00Z',
  });
}

// ── Public API ────────────────────────────────────────────────────────

/** Register an external network as a federation peer. */
export function registerExternalNetwork(req: RegisterNetworkRequest): FederatedNetwork {
  const networkId = `net-${randomUUID().slice(0, 8)}`;

  const network: FederatedNetwork = {
    networkId,
    networkName: req.networkName,
    endpoint: req.endpoint,
    publicKey: req.publicKey,
    networkType: req.networkType,
    status: 'PENDING',
    didMethods: req.didMethods ?? [],
    registeredAt: new Date().toISOString(),
    metadata: req.metadata,
  };

  networks.set(networkId, network);

  log('info', 'federated_network_registered', {
    networkId,
    networkName: req.networkName,
    networkType: req.networkType,
  });

  return network;
}

/** List all federation peers. */
export function listFederatedNetworks(status?: FederatedNetworkStatus): FederatedNetwork[] {
  const all = Array.from(networks.values()).sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
  );
  return status ? all.filter((n) => n.status === status) : all;
}

/** Get a single network by ID. */
export function getFederatedNetwork(networkId: string): FederatedNetwork | null {
  return networks.get(networkId) ?? null;
}

/** Update network status. */
export function updateNetworkStatus(
  networkId: string,
  status: FederatedNetworkStatus,
  syncMeta?: { nodeCount: number; lastSyncAt: string },
): FederatedNetwork | null {
  const network = networks.get(networkId);
  if (!network) return null;

  const updated: FederatedNetwork = {
    ...network,
    status,
    ...(syncMeta && { nodeCount: syncMeta.nodeCount, lastSyncAt: syncMeta.lastSyncAt }),
  };
  networks.set(networkId, updated);

  log('info', 'federated_network_status_updated', { networkId, status });
  return updated;
}

/** Build federated graph nodes for global graph inclusion (Wave 102 + 96 integration). */
export function getFederatedGraphNodes(): Array<{
  id: string;
  label: string;
  group: 'federated_issuer';
  val: number;
  networkId: string;
  endpoint: string;
  status: FederatedNetworkStatus;
}> {
  return Array.from(networks.values())
    .filter((n) => n.status === 'ACTIVE' || n.status === 'PENDING')
    .map((n) => ({
      id: `fednet-${n.networkId}`,
      label: n.networkName,
      group: 'federated_issuer' as const,
      val: 7,
      networkId: n.networkId,
      endpoint: n.endpoint,
      status: n.status,
    }));
}
