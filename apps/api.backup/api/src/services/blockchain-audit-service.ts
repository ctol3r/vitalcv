/**
 * Blockchain Audit Service
 * LEDGER-012: Connect API to blockchain audit pallet
 *
 * Replaces console logs with async extrinsics (fire-and-forget with retry queue).
 * For each VC Issue, Revoke, Verify, Access, compute peppered hash and submit AuditRecord.
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import * as crypto from 'crypto';

export interface AuditEvent {
  action_type: 'ISSUE' | 'REVOKE' | 'VERIFY' | 'ACCESS';
  target_hash: string; // Peppered hash of credential
  actor_did: string; // DID of the actor
  meta_hash: string; // Hash of metadata
  timestamp?: number; // Optional timestamp override
}

export interface AuditQueueItem {
  event: AuditEvent;
  retries: number;
  nextRetry: Date;
  createdAt: Date;
}

/**
 * Blockchain Audit Service
 *
 * Manages async audit record submission to Substrate blockchain with:
 * - Fire-and-forget pattern
 * - Retry queue with exponential backoff
 * - Batch submission support
 * - Error handling and logging
 */
export class BlockchainAuditService {
  private api: ApiPromise | null = null;
  private signer: KeyringPair | null = null;
  private wsProvider: WsProvider | null = null;
  private queue: AuditQueueItem[] = [];
  private processing: boolean = false;
  private pepper: Buffer;

  // Configuration
  private readonly maxRetries = 5;
  private readonly initialRetryDelay = 1000; // 1 second
  private readonly maxRetryDelay = 60000; // 60 seconds
  private readonly batchSize = 10;
  private readonly queueFlushInterval = 5000; // 5 seconds

  constructor() {
    // Generate or load pepper for hashing (should be consistent across restarts)
    this.pepper = Buffer.from(
      process.env.AUDIT_PEPPER ||
      crypto.createHash('sha256').update('vitalcv-audit-pepper').digest('hex'),
      'hex'
    );
  }

  /**
   * Initialize connection to Substrate node
   */
  async initialize(): Promise<void> {
    const wsUrl = process.env.SUBSTRATE_WS_URL || 'ws://localhost:9944';

    try {
      this.wsProvider = new WsProvider(wsUrl);
      this.api = await ApiPromise.create({ provider: this.wsProvider });

      // Wait for API to be ready
      await this.api.isReady;

      // Initialize signer (use environment variable or generate)
      const seed = process.env.SUBSTRATE_SIGNER_SEED || '//Alice'; // Development only
      const keyring = new Keyring({ type: 'sr25519' });
      this.signer = keyring.addFromUri(seed);

      console.log('[BlockchainAuditService] Connected to Substrate node');

      // Start queue processing
      this.startQueueProcessor();

    } catch (error) {
      console.error('[BlockchainAuditService] Failed to initialize:', error);
      // Continue in degraded mode (queue events but don't submit)
    }
  }

  /**
   * Compute peppered hash of credential for GDPR compliance
   */
  private computePepperedHash(credentialId: string, additionalData?: string): string {
    const data = additionalData ? `${credentialId}:${additionalData}` : credentialId;
    const hash = crypto
      .createHmac('sha256', this.pepper)
      .update(data)
      .digest('hex');
    return hash;
  }

  /**
   * Compute metadata hash
   */
  private computeMetaHash(metadata: Record<string, any>): string {
    const json = JSON.stringify(metadata);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Record VC Issue event
   */
  async recordIssue(
    credentialId: string,
    issuerDid: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const targetHash = this.computePepperedHash(credentialId, 'issue');
    const metaHash = this.computeMetaHash(metadata || {});

    await this.recordAudit({
      action_type: 'ISSUE',
      target_hash: targetHash,
      actor_did: issuerDid,
      meta_hash: metaHash,
    });
  }

  /**
   * Record VC Revoke event
   */
  async recordRevoke(
    credentialId: string,
    revokerDid: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const targetHash = this.computePepperedHash(credentialId, 'revoke');
    const metaHash = this.computeMetaHash(metadata || {});

    await this.recordAudit({
      action_type: 'REVOKE',
      target_hash: targetHash,
      actor_did: revokerDid,
      meta_hash: metaHash,
    });
  }

  /**
   * Record VC Verify event
   */
  async recordVerify(
    credentialId: string,
    verifierDid: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const targetHash = this.computePepperedHash(credentialId, 'verify');
    const metaHash = this.computeMetaHash(metadata || {});

    await this.recordAudit({
      action_type: 'VERIFY',
      target_hash: targetHash,
      actor_did: verifierDid,
      meta_hash: metaHash,
    });
  }

  /**
   * Record VC Access event
   */
  async recordAccess(
    credentialId: string,
    accessorDid: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const targetHash = this.computePepperedHash(credentialId, 'access');
    const metaHash = this.computeMetaHash(metadata || {});

    await this.recordAudit({
      action_type: 'ACCESS',
      target_hash: targetHash,
      actor_did: accessorDid,
      meta_hash: metaHash,
    });
  }

  /**
   * Record audit event (adds to queue for async processing)
   */
  private async recordAudit(event: AuditEvent): Promise<void> {
    const queueItem: AuditQueueItem = {
      event: {
        ...event,
        timestamp: event.timestamp || Date.now(),
      },
      retries: 0,
      nextRetry: new Date(),
      createdAt: new Date(),
    };

    this.queue.push(queueItem);

    // Fire-and-forget: return immediately, process async
    // Queue processor will handle submission
  }

  /**
   * Start queue processor (runs in background)
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) {
        return;
      }

      await this.processQueue();
    }, this.queueFlushInterval);
  }

  /**
   * Process audit queue
   */
  private async processQueue(): Promise<void> {
    if (!this.api || !this.signer || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Filter items ready for retry
      const now = new Date();
      const readyItems = this.queue.filter(
        (item) => item.nextRetry <= now || item.retries === 0
      );

      if (readyItems.length === 0) {
        this.processing = false;
        return;
      }

      // Process in batches
      const batches = this.chunkArray(readyItems, this.batchSize);

      for (const batch of batches) {
        await this.submitBatch(batch);
      }
    } catch (error) {
      console.error('[BlockchainAuditService] Queue processing error:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Submit batch of audit records
   */
  private async submitBatch(items: AuditQueueItem[]): Promise<void> {
    if (!this.api || !this.signer) {
      return;
    }

    try {
      // Prepare batch records
      const records = items.map((item) => {
        const { action_type, target_hash, actor_did, meta_hash } = item.event;

        // Convert action type string to enum
        const actionTypeEnum = this.mapActionType(action_type);

        return [
          actionTypeEnum,
          Buffer.from(target_hash, 'hex'),
          Buffer.from(actor_did, 'utf-8'),
          Buffer.from(meta_hash, 'hex'),
        ];
      });

      // Submit batch extrinsic
      const extrinsic = this.api.tx.auditScrapbook.batchRecordAudit(records);

      // Sign and send (fire-and-forget)
      await extrinsic.signAndSend(this.signer, { nonce: -1 });

      // Remove successfully submitted items from queue
      items.forEach((item) => {
        const index = this.queue.indexOf(item);
        if (index > -1) {
          this.queue.splice(index, 1);
        }
      });

      console.log(`[BlockchainAuditService] Submitted ${items.length} audit records`);
    } catch (error) {
      console.error('[BlockchainAuditService] Batch submission error:', error);

      // Schedule retry with exponential backoff
      items.forEach((item) => {
        item.retries += 1;

        if (item.retries < this.maxRetries) {
          const delay = Math.min(
            this.initialRetryDelay * Math.pow(2, item.retries),
            this.maxRetryDelay
          );
          item.nextRetry = new Date(Date.now() + delay);
        } else {
          // Max retries exceeded, remove from queue (log for manual review)
          console.error('[BlockchainAuditService] Max retries exceeded for audit record:', item);
          const index = this.queue.indexOf(item);
          if (index > -1) {
            this.queue.splice(index, 1);
          }
        }
      });
    }
  }

  /**
   * Map action type string to pallet enum
   */
  private mapActionType(actionType: string): any {
    // This should match the ActionType enum in the Rust pallet
    switch (actionType) {
      case 'ISSUE':
        return { Issue: null };
      case 'REVOKE':
        return { Revoke: null };
      case 'VERIFY':
        return { Verify: null };
      case 'ACCESS':
        return { Access: null };
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    processing: boolean;
    connected: boolean;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      connected: this.api?.isConnected || false,
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.api) {
      await this.api.disconnect();
    }
  }
}

// Singleton instance
let auditServiceInstance: BlockchainAuditService | null = null;

export function getAuditService(): BlockchainAuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new BlockchainAuditService();
    // Initialize in background
    auditServiceInstance.initialize().catch((error) => {
      console.error('[BlockchainAuditService] Initialization error:', error);
    });
  }
  return auditServiceInstance;
}

