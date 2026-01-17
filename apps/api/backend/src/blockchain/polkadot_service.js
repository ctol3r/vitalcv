'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PolkadotService = void 0;
const api_1 = require('@polkadot/api');
const key_rotation_policy_1 = require('./key_rotation_policy');
/**
 * Service wrapping Polkadot-js API interactions.
 */
class PolkadotService {
  constructor(initialKey, cfg) {
    this.api = null;
    this.endpointIndex = 0;
    this.keyPolicy = new key_rotation_policy_1.KeyRotationPolicy(initialKey || 'default-key');
    this.cfg = {
      endpoints: cfg?.endpoints?.length ? cfg.endpoints : ['ws://127.0.0.1:9944'],
      connectTimeoutMs: cfg?.connectTimeoutMs ?? 12000,
      maxConnectAttempts: cfg?.maxConnectAttempts ?? 5,
      retryBackoffMs: cfg?.retryBackoffMs ?? 750,
      maxAllowedLagBlocks: cfg?.maxAllowedLagBlocks ?? 64,
    };
  }
  /** Connect to a chain endpoint using WebSockets (with retries + endpoint fallback). */
  async connect(endpoint) {
    if (process.env.CHAIN_DISABLED === 'true' || process.env.NODE_ENV === 'test') {
      return;
    }
    if (endpoint) {
      const endpoints = Array.isArray(endpoint) ? endpoint : [endpoint];
      this.cfg.endpoints = endpoints;
      this.endpointIndex = 0;
    }
    // If already connected and healthy, keep current connection.
    if (this.api) {
      const health = await this.getHealth().catch(() => null);
      if (health && !health.isSyncing && health.lagBlocks <= this.cfg.maxAllowedLagBlocks) {
        return;
      }
      await this.disconnect().catch(() => undefined);
    }
    const endpoints = this.cfg.endpoints;
    let lastErr;
    for (let attempt = 0; attempt < this.cfg.maxConnectAttempts; attempt++) {
      const ep = endpoints[this.endpointIndex % endpoints.length];
      this.endpointIndex++;
      try {
        const provider = new api_1.WsProvider(ep, this.cfg.connectTimeoutMs);
        const api = await api_1.ApiPromise.create({ provider });
        // Basic sanity check: RPC responsive
        await Promise.race([
          api.rpc.system.health(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('health timeout')), this.cfg.connectTimeoutMs),
          ),
        ]);
        this.api = api;
        // If lagging badly, rotate endpoint once and retry.
        const health = await this.getHealth().catch(() => null);
        if (health && health.lagBlocks > this.cfg.maxAllowedLagBlocks) {
          await this.disconnect().catch(() => undefined);
          throw new Error(`connected node lagging: lagBlocks=${health.lagBlocks}`);
        }
        return;
      } catch (e) {
        lastErr = e;
        await this.sleep(this.cfg.retryBackoffMs * (attempt + 1));
      }
    }
    throw new Error(`Failed to connect to chain endpoints: ${String(lastErr)}`);
  }
  async disconnect() {
    if (!this.api) return;
    try {
      await this.api.disconnect();
    } finally {
      this.api = null;
    }
  }
  /** Health check + lag detection (best vs finalized). */
  async getHealth() {
    const api = this.requireApi();
    const [sysHealth, bestHeader, finalizedHash] = await Promise.all([
      api.rpc.system.health(),
      api.rpc.chain.getHeader(),
      api.rpc.chain.getFinalizedHead(),
    ]);
    const finalizedHeader = await api.rpc.chain.getHeader(finalizedHash);
    const bestNumber = bestHeader.number.toNumber();
    const finalizedNumber = finalizedHeader.number.toNumber();
    const lagBlocks = Math.max(0, bestNumber - finalizedNumber);
    return {
      isSyncing: sysHealth.isSyncing.isTrue,
      peers: sysHealth.peers.toNumber(),
      bestNumber,
      finalizedNumber,
      lagBlocks,
    };
  }
  /**
   * Execute a chain call with automatic reconnect if the node is unhealthy/lagging.
   */
  async withApi(fn) {
    if (!this.api) await this.connect();
    const health = await this.getHealth().catch(() => null);
    if (!health || health.isSyncing || health.lagBlocks > this.cfg.maxAllowedLagBlocks) {
      await this.disconnect().catch(() => undefined);
      await this.connect();
    }
    return fn(this.requireApi());
  }
  /** Issue a credential to a destination account. */
  async issueCredential(signer, dest, data) {
    return this.withApi(async (api) => {
      const tx = api.tx.credentialsModule.issueCredential(dest, data);
      const txHash = await tx.signAndSend(signer);
      return txHash.toHex();
    });
  }
  /**
   * Batch multiple credential issuance calls into a single extrinsic using
   * the utility.batch function.
   */
  async batchIssueCredentials(signer, destinations, data) {
    if (destinations.length !== data.length) {
      throw new Error('Array lengths must match');
    }
    return this.withApi(async (api) => {
      const calls = destinations.map((dest, i) =>
        api.tx.credentialsModule.issueCredential(dest, data[i]),
      );
      const batch = api.tx.utility.batch(calls);
      const txHash = await batch.signAndSend(signer);
      return txHash.toHex();
    });
  }
  /** Store audit record on-chain for immutable tracking. */
  async storeAuditRecord(record) {
    // This is a placeholder for the actual interaction with the Polkadot
    // blockchain which would store a hash of the audit data.
    console.log('Storing record on-chain:', record);
  }
  /**
   * Anchor a pre-computed SHA-256 hash on-chain.
   * Returns a transaction hash placeholder for now.
   */
  async anchorData(hash) {
    if (!hash || typeof hash !== 'string') {
      throw new Error('anchorData requires a hash string');
    }
    const normalized = hash.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error('anchorData requires a 64-character hex SHA-256 hash');
    }
    console.log('Anchoring data hash on-chain:', normalized);
    PolkadotService.anchoredHashes.add(normalized);
    return `0x${normalized.slice(0, 16)}`;
  }
  static hasAnchoredHash(hash) {
    return PolkadotService.anchoredHashes.has(hash.toLowerCase());
  }
  static clearAnchoredHashes() {
    PolkadotService.anchoredHashes.clear();
  }
  /**
   * Persist an anonymized erasure record to the blockchain.
   * The implementation is a stub for demonstration purposes.
   */
  async recordErasure(record) {
    // In a real implementation, this would submit a transaction to the chain.
    console.log('Recording erasure on-chain:', record);
  }
  /**
   * Schedule rotation of the signing key used for transactions.
   */
  scheduleKeyRotation(newKey, transitionTime) {
    this.keyPolicy.scheduleRotation(newKey, transitionTime);
  }
  /**
   * Retrieve the key that should be used for signing at the given time.
   */
  getSigningKey(currentTime = Date.now()) {
    return this.keyPolicy.getActiveKey(currentTime);
  }
  requireApi() {
    if (!this.api) throw new Error('API not connected');
    return this.api;
  }
  async sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
exports.PolkadotService = PolkadotService;
PolkadotService.anchoredHashes = new Set();
