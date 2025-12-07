/**
 * AccountabilityLedger
 *
 * Immutable log of all decisions, inputs, modules invoked, outcomes.
 * Signed and anchorable to NCI (Network Credential Infrastructure).
 */

import { PrismaClient } from '@prisma/client';
import { createHash, createSign, createVerify } from 'crypto';
import { createLogger } from '@chai-vc/logging-core';
import type { ExplanationGraph } from './graph/builder.js';

const logger = createLogger({ service: 'explainability-ledger' });
const prisma = new PrismaClient();

/**
 * Ledger entry types
 */
export enum LedgerEntryType {
  DECISION = 'decision',
  MODULE_INVOCATION = 'module_invocation',
  KERNEL_EXECUTION = 'kernel_execution',
  SIGNAL_COLLECTION = 'signal_collection',
  RULE_EVALUATION = 'rule_evaluation',
  OUTCOME = 'outcome',
}

/**
 * Ledger entry
 */
export interface LedgerEntry {
  /** Entry ID */
  id: string;
  /** Entry type */
  type: LedgerEntryType;
  /** Timestamp */
  timestamp: Date;
  /** Organization ID */
  orgId?: string;
  /** Decision ID or context */
  decisionId?: string;
  /** Input data */
  inputs: Record<string, unknown>;
  /** Modules invoked */
  modulesInvoked?: Array<{
    moduleId: string;
    capability: string;
    timestamp: Date;
    outcome?: unknown;
  }>;
  /** Kernels executed */
  kernelsExecuted?: Array<{
    kernelId: string;
    operation: string;
    timestamp: Date;
    result?: unknown;
  }>;
  /** Outcomes */
  outcomes?: Array<{
    type: string;
    result: unknown;
    timestamp: Date;
  }>;
  /** Previous entry hash (for chain integrity) */
  previousHash?: string;
  /** Entry hash */
  hash: string;
  /** Digital signature */
  signature?: string;
  /** NCI anchor (if anchored) */
  nciAnchor?: {
    txHash: string;
    blockNumber: number;
    timestamp: Date;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Ledger entry input for creation
 */
export interface LedgerEntryInput {
  /** Entry type */
  type: LedgerEntryType;
  /** Organization ID */
  orgId?: string;
  /** Decision ID */
  decisionId?: string;
  /** Input data */
  inputs: Record<string, unknown>;
  /** Modules invoked */
  modulesInvoked?: Array<{
    moduleId: string;
    capability: string;
    timestamp: Date;
    outcome?: unknown;
  }>;
  /** Kernels executed */
  kernelsExecuted?: Array<{
    kernelId: string;
    operation: string;
    timestamp: Date;
    result?: unknown;
  }>;
  /** Outcomes */
  outcomes?: Array<{
    type: string;
    result: unknown;
    timestamp: Date;
  }>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Accountability ledger service
 */
export class AccountabilityLedger {
  private signingKey?: Buffer;

  constructor(signingKey?: Buffer) {
    this.signingKey = signingKey;
  }

  /**
   * Create a new ledger entry
   */
  async createEntry(
    input: LedgerEntryInput,
    previousEntryId?: string
  ): Promise<LedgerEntry> {
    const timestamp = new Date();

    // Get previous entry hash if provided
    let previousHash: string | undefined;
    if (previousEntryId) {
      const previousEntry = await this.getEntry(previousEntryId);
      if (previousEntry) {
        previousHash = previousEntry.hash;
      }
    } else {
      // Get latest entry for this org
      const latestEntry = await this.getLatestEntry(input.orgId);
      if (latestEntry) {
        previousHash = latestEntry.hash;
      }
    }

    // Calculate hash
    const hash = this.calculateHash(input, previousHash, timestamp);

    // Sign entry if key provided
    let signature: string | undefined;
    if (this.signingKey) {
      signature = this.signEntry(hash);
    }

    const entry: LedgerEntry = {
      id: `ledger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: input.type,
      timestamp,
      orgId: input.orgId,
      decisionId: input.decisionId,
      inputs: input.inputs,
      modulesInvoked: input.modulesInvoked,
      kernelsExecuted: input.kernelsExecuted,
      outcomes: input.outcomes,
      previousHash,
      hash,
      signature,
      metadata: input.metadata,
    };

    // Store in database (immutable)
    await this.storeEntry(entry);

    logger.info('Created ledger entry', {
      entryId: entry.id,
      type: entry.type,
      hash: entry.hash,
      hasSignature: !!signature,
    });

    return entry;
  }

  /**
   * Create entry from explanation graph
   */
  async createEntryFromGraph(
    graph: ExplanationGraph,
    orgId?: string
  ): Promise<LedgerEntry> {
    const decisionNodes = graph.nodes.filter(
      (n) => n.type === 'supervisor_decision' as any
    );
    const moduleNodes = graph.nodes.filter(
      (n) => n.type === 'module_invocation' as any
    );
    const kernelNodes = graph.nodes.filter(
      (n) => n.type === 'kernel_execution' as any
    );
    const outcomeNodes = graph.nodes.filter(
      (n) => n.type === 'outcome' as any
    );

    const input: LedgerEntryInput = {
      type: LedgerEntryType.DECISION,
      orgId,
      decisionId: graph.id,
      inputs: {
        graphId: graph.id,
        rootNodeId: graph.rootNodeId,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      },
      modulesInvoked: moduleNodes.map((node) => ({
        moduleId: node.data.moduleId as string,
        capability: node.data.capability as string,
        timestamp: node.timestamp,
        outcome: node.data.outcome,
      })),
      kernelsExecuted: kernelNodes.map((node) => ({
        kernelId: node.data.kernelId as string,
        operation: node.data.operation as string,
        timestamp: node.timestamp,
        result: node.data.result,
      })),
      outcomes: outcomeNodes.map((node) => ({
        type: node.data.type as string,
        result: node.data.result,
        timestamp: node.timestamp,
      })),
      metadata: graph.metadata,
    };

    return this.createEntry(input);
  }

  /**
   * Get entry by ID
   */
  async getEntry(entryId: string): Promise<LedgerEntry | null> {
    // In a real implementation, this would query the database
    // For now, return null as placeholder
    logger.debug('Getting ledger entry', { entryId });
    return null;
  }

  /**
   * Get latest entry for organization
   */
  async getLatestEntry(orgId?: string): Promise<LedgerEntry | null> {
    // In a real implementation, this would query the database
    logger.debug('Getting latest ledger entry', { orgId });
    return null;
  }

  /**
   * Get all entries for organization
   */
  async getEntries(
    orgId?: string,
    limit?: number
  ): Promise<LedgerEntry[]> {
    // In a real implementation, this would query the database
    logger.debug('Getting ledger entries', { orgId, limit });
    return [];
  }

  /**
   * Verify entry integrity
   */
  async verifyEntry(entry: LedgerEntry): Promise<boolean> {
    // Verify hash
    const calculatedHash = this.calculateHash(
      {
        type: entry.type,
        orgId: entry.orgId,
        decisionId: entry.decisionId,
        inputs: entry.inputs,
        modulesInvoked: entry.modulesInvoked,
        kernelsExecuted: entry.kernelsExecuted,
        outcomes: entry.outcomes,
        metadata: entry.metadata,
      },
      entry.previousHash,
      entry.timestamp
    );

    if (calculatedHash !== entry.hash) {
      logger.warn('Ledger entry hash mismatch', {
        entryId: entry.id,
        calculatedHash,
        storedHash: entry.hash,
      });
      return false;
    }

    // Verify signature if present
    if (entry.signature && this.signingKey) {
      const isValid = this.verifySignature(entry.hash, entry.signature);
      if (!isValid) {
        logger.warn('Ledger entry signature invalid', { entryId: entry.id });
        return false;
      }
    }

    return true;
  }

  /**
   * Anchor entry to NCI
   */
  async anchorToNCI(entryId: string): Promise<{
    success: boolean;
    txHash?: string;
    blockNumber?: number;
    error?: string;
  }> {
    const entry = await this.getEntry(entryId);
    if (!entry) {
      return {
        success: false,
        error: 'Entry not found',
      };
    }

    // Verify entry before anchoring
    const isValid = await this.verifyEntry(entry);
    if (!isValid) {
      return {
        success: false,
        error: 'Entry verification failed',
      };
    }

    // In a real implementation, this would:
    // 1. Create a transaction to anchor the hash to NCI
    // 2. Wait for transaction confirmation
    // 3. Update entry with anchor information

    logger.info('Anchoring ledger entry to NCI', {
      entryId,
      hash: entry.hash,
    });

    // Placeholder implementation
    const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    const mockBlockNumber = Math.floor(Math.random() * 1000000);

    // Update entry with anchor (in real implementation, would update database)
    entry.nciAnchor = {
      txHash: mockTxHash,
      blockNumber: mockBlockNumber,
      timestamp: new Date(),
    };

    return {
      success: true,
      txHash: mockTxHash,
      blockNumber: mockBlockNumber,
    };
  }

  /**
   * Calculate hash for entry
   */
  private calculateHash(
    input: LedgerEntryInput,
    previousHash: string | undefined,
    timestamp: Date
  ): string {
    const data = JSON.stringify({
      type: input.type,
      orgId: input.orgId,
      decisionId: input.decisionId,
      inputs: input.inputs,
      modulesInvoked: input.modulesInvoked,
      kernelsExecuted: input.kernelsExecuted,
      outcomes: input.outcomes,
      previousHash,
      timestamp: timestamp.toISOString(),
      metadata: input.metadata,
    });

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sign entry hash
   */
  private signEntry(hash: string): string {
    if (!this.signingKey) {
      throw new Error('Signing key not configured');
    }

    // In a real implementation, would use proper cryptographic signing
    // This is a placeholder
    const sign = createSign('RSA-SHA256');
    sign.update(hash);
    sign.end();
    return sign.sign(this.signingKey, 'hex');
  }

  /**
   * Verify signature
   */
  private verifySignature(hash: string, signature: string): boolean {
    if (!this.signingKey) {
      return false;
    }

    // In a real implementation, would use proper cryptographic verification
    // This is a placeholder
    try {
      const verify = createVerify('RSA-SHA256');
      verify.update(hash);
      verify.end();
      return verify.verify(this.signingKey, signature, 'hex');
    } catch (error) {
      logger.error('Signature verification error', { error });
      return false;
    }
  }

  /**
   * Store entry in database (immutable)
   */
  private async storeEntry(entry: LedgerEntry): Promise<void> {
    // In a real implementation, would store in database
    // For now, just log
    logger.debug('Storing ledger entry', {
      entryId: entry.id,
      hash: entry.hash,
    });

    // TODO: Implement database storage
    // Would use Prisma to insert into AccountabilityLedgerEntry table
    // Table would have fields: id, type, timestamp, orgId, decisionId, inputs (JSON),
    // modulesInvoked (JSON), kernelsExecuted (JSON), outcomes (JSON), previousHash,
    // hash, signature, nciAnchor (JSON), metadata (JSON)
  }
}

/**
 * Create a new accountability ledger
 */
export function createAccountabilityLedger(
  signingKey?: Buffer
): AccountabilityLedger {
  return new AccountabilityLedger(signingKey);
}

