/**
 * Legacy Substrate Integration (Deprecated)
 *
 * This file is kept for backwards compatibility.
 * New code should use the services in /chain/ directory:
 * - PolkadotService for connection management
 * - CredentialChainService for anchoring
 * - TrustRegistryService for trust registry
 *
 * See: apps/api/src/chain/index.ts
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

let _api: ApiPromise;

/**
 * @deprecated Use PolkadotService.getInstance() instead
 */
export async function api() {
  if (_api) return _api;
  const ws = process.env.SUBSTRATE_WS || process.env.SUBSTRATE_WS_URL || 'ws://localhost:9944';
  _api = await ApiPromise.create({ provider: new WsProvider(ws) });
  return _api;
}

/**
 * @deprecated Use CredentialChainService.anchorCredential() instead
 */
export async function anchorMerkleRoot(root: string) {
  const a = await api();
  // placeholder pallet call; replace with custom pallet in pilot
  // For demo, emit a system.remark to prove connectivity
  // @ts-ignore
  const tx = (a.tx?.system?.remark || a.tx?.utility?.remark) ? a.tx.system.remark(root) : null;
  if (!tx) return { ok: false, note: 'remark not available on this chain' };
  return { ok: true, note: 'simulated anchor', root };
}

/**
 * @deprecated Use ChainEventListener for real-time anchors
 */
export async function recentAnchors() {
  return [{ id: 'root-demo', ts: Date.now(), count: 128 }];
}

