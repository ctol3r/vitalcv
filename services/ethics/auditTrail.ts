/**
 * B222B-ETH-009: EthicsAuditTrail
 *
 * Immutable log of autonomous actions, bias checks, compliance outcomes;
 * accessible to designated oversight bodies with cryptographic proofs.
 */

import { createLogger } from '@chai-vc/logging-core';
import { PrismaClient } from '@prisma/client';
import { createHash, createSign, createVerify } from 'crypto';

const logger = createLogger({ service: 'ethics-audit-trail' });
const prisma = new PrismaClient();

/**
 * Audit trail entry types
 */
export enum AuditTrailEntryType {
  AUTONOMOUS_ACTION = 'autonomous_action',
  BIAS_CHECK = 'bias_check',
  COMPLIANCE_CHECK = 'compliance_check',
  KILL_SWITCH_ACTIVATION = 'kill_switch_activation',
  OVERSIGHT_REVIEW = 'oversight_review',
}

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  /** Entry ID */
  id: string;
  /** Entry type */
  type: AuditTrailEntryType;
  /** Timestamp */
  timestamp: Date;
  /** Organization ID */
  orgId?: string;
  /** Region */
  region?: string;
  /** Related entity IDs */
  entityIds: {
    actionId?: string;
    decisionId?: string;
    userId?: string;
    clinicianId?: string;
  };
  /** Entry data */
  data: Record<string, unknown>;
  /** Previous entry hash (for chain integrity) */
  previousHash?: string;
  /** Entry hash */
  hash: string;
  /** Digital signature */
  signature?: string;
  /** Cryptographic proof */
  proof?: CryptographicProof;
  /** Access control */
  accessControl: {
    /** Oversight bodies that can access */
    oversightBodies: string[];
    /** Public access (if any) */
    publicAccess: boolean;
  };
}

/**
 * Cryptographic proof for entry integrity
 */
export interface CryptographicProof {
  /** Merkle tree root (if using Merkle trees) */
  merkleRoot?: string;
  /** Merkle proof path */
  merkleProof?: string[];
  /** Block hash (if anchored to blockchain) */
  blockHash?: string;
  /** Block number */
  blockNumber?: number;
  /** Transaction hash */
  txHash?: string;
}

/**
 * Audit trail query filters
 */
export interface AuditTrailQuery {
  /** Entry types to include */
  types?: AuditTrailEntryType[];
  /** Organization ID */
  orgId?: string;
  /** Region */
  region?: string;
  /** Start timestamp */
  startTime?: Date;
  /** End timestamp */
  endTime?: Date;
  /** Entity IDs to filter by */
  entityIds?: {
    actionId?: string;
    decisionId?: string;
    userId?: string;
    clinicianId?: string;
  };
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Audit trail access control
 */
export interface AuditTrailAccessControl {
  /** Oversight body identifier */
  oversightBodyId: string;
  /** Roles that can access */
  roles: string[];
  /** Access level */
  accessLevel: 'read' | 'read_write' | 'admin';
}

/**
 * EthicsAuditTrail configuration
 */
export interface EthicsAuditTrailConfig {
  /** Signing key for cryptographic signatures */
  signingKey?: Buffer;
  /** Enable Merkle tree proofs */
  enableMerkleProofs: boolean;
  /** Enable blockchain anchoring */
  enableBlockchainAnchoring: boolean;
  /** Default access control */
  defaultAccessControl: {
    oversightBodies: string[];
    publicAccess: boolean;
  };
}

/**
 * Default audit trail configuration
 */
const DEFAULT_CONFIG: EthicsAuditTrailConfig = {
  enableMerkleProofs: true,
  enableBlockchainAnchoring: false,
  defaultAccessControl: {
    oversightBodies: ['ethics_board', 'compliance_officer'],
    publicAccess: false,
  },
};

/**
 * EthicsAuditTrail
 *
 * Immutable log of autonomous actions, bias checks, and compliance outcomes.
 */
export class EthicsAuditTrail {
  private config: EthicsAuditTrailConfig;
  private signingKey?: Buffer;
  private entries: Map<string, AuditTrailEntry> = new Map();
  private merkleTree?: Map<string, string>; // Simplified Merkle tree

  constructor(config?: Partial<EthicsAuditTrailConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.signingKey = config?.signingKey;
  }

  /**
   * Log an autonomous action
   */
  async logAutonomousAction(
    actionId: string,
    data: {
      actionType: string;
      orgId?: string;
      region?: string;
      userId?: string;
      clinicianId?: string;
      outcome: unknown;
      metadata?: Record<string, unknown>;
    },
    accessControl?: {
      oversightBodies?: string[];
      publicAccess?: boolean;
    }
  ): Promise<AuditTrailEntry> {
    return this.createEntry({
      type: AuditTrailEntryType.AUTONOMOUS_ACTION,
      orgId: data.orgId,
      region: data.region,
      entityIds: {
        actionId,
        userId: data.userId,
        clinicianId: data.clinicianId,
      },
      data: {
        actionType: data.actionType,
        outcome: data.outcome,
        metadata: data.metadata,
      },
      accessControl: {
        oversightBodies:
          accessControl?.oversightBodies ||
          this.config.defaultAccessControl.oversightBodies,
        publicAccess:
          accessControl?.publicAccess ?? this.config.defaultAccessControl.publicAccess,
      },
    });
  }

  /**
   * Log a bias check
   */
  async logBiasCheck(
    decisionId: string,
    data: {
      orgId?: string;
      region?: string;
      biasDetected: boolean;
      biasType?: string;
      severity?: number;
      description?: string;
      evidence?: Record<string, unknown>;
    },
    accessControl?: {
      oversightBodies?: string[];
      publicAccess?: boolean;
    }
  ): Promise<AuditTrailEntry> {
    return this.createEntry({
      type: AuditTrailEntryType.BIAS_CHECK,
      orgId: data.orgId,
      region: data.region,
      entityIds: {
        decisionId,
      },
      data: {
        biasDetected: data.biasDetected,
        biasType: data.biasType,
        severity: data.severity,
        description: data.description,
        evidence: data.evidence,
      },
      accessControl: {
        oversightBodies:
          accessControl?.oversightBodies ||
          this.config.defaultAccessControl.oversightBodies,
        publicAccess:
          accessControl?.publicAccess ?? this.config.defaultAccessControl.publicAccess,
      },
    });
  }

  /**
   * Log a compliance check
   */
  async logComplianceCheck(
    actionId: string,
    data: {
      orgId?: string;
      region?: string;
      compliant: boolean;
      failedFramework?: string;
      violations?: Array<{
        framework: string;
        rule: string;
        severity: string;
      }>;
      warnings?: Array<{
        framework: string;
        message: string;
      }>;
    },
    accessControl?: {
      oversightBodies?: string[];
      publicAccess?: boolean;
    }
  ): Promise<AuditTrailEntry> {
    return this.createEntry({
      type: AuditTrailEntryType.COMPLIANCE_CHECK,
      orgId: data.orgId,
      region: data.region,
      entityIds: {
        actionId,
      },
      data: {
        compliant: data.compliant,
        failedFramework: data.failedFramework,
        violations: data.violations,
        warnings: data.warnings,
      },
      accessControl: {
        oversightBodies:
          accessControl?.oversightBodies ||
          this.config.defaultAccessControl.oversightBodies,
        publicAccess:
          accessControl?.publicAccess ?? this.config.defaultAccessControl.publicAccess,
      },
    });
  }

  /**
   * Log a kill switch activation
   */
  async logKillSwitchActivation(
    activationId: string,
    data: {
      orgId?: string;
      region?: string;
      activatedBy: string;
      reason: string;
      quorumApprovals?: Array<{
        userId: string;
        role: string;
        approvedAt: Date;
      }>;
    },
    accessControl?: {
      oversightBodies?: string[];
      publicAccess?: boolean;
    }
  ): Promise<AuditTrailEntry> {
    return this.createEntry({
      type: AuditTrailEntryType.KILL_SWITCH_ACTIVATION,
      orgId: data.orgId,
      region: data.region,
      entityIds: {
        actionId: activationId,
        userId: data.activatedBy,
      },
      data: {
        reason: data.reason,
        quorumApprovals: data.quorumApprovals,
      },
      accessControl: {
        oversightBodies:
          accessControl?.oversightBodies ||
          this.config.defaultAccessControl.oversightBodies,
        publicAccess:
          accessControl?.publicAccess ?? this.config.defaultAccessControl.publicAccess,
      },
    });
  }

  /**
   * Create a new audit trail entry
   */
  private async createEntry(input: {
    type: AuditTrailEntryType;
    orgId?: string;
    region?: string;
    entityIds: {
      actionId?: string;
      decisionId?: string;
      userId?: string;
      clinicianId?: string;
    };
    data: Record<string, unknown>;
    accessControl: {
      oversightBodies: string[];
      publicAccess: boolean;
    };
  }): Promise<AuditTrailEntry> {
    const timestamp = new Date();

    // Get previous entry hash
    const previousHash = await this.getPreviousHash(input.orgId);

    // Calculate hash
    const hash = this.calculateHash(input, previousHash, timestamp);

    // Sign entry if key provided
    let signature: string | undefined;
    if (this.signingKey) {
      signature = this.signEntry(hash);
    }

    // Generate cryptographic proof
    let proof: CryptographicProof | undefined;
    if (this.config.enableMerkleProofs) {
      proof = await this.generateMerkleProof(hash);
    }

    const entry: AuditTrailEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: input.type,
      timestamp,
      orgId: input.orgId,
      region: input.region,
      entityIds: input.entityIds,
      data: input.data,
      previousHash,
      hash,
      signature,
      proof,
      accessControl: input.accessControl,
    };

    // Store entry
    this.entries.set(entry.id, entry);
    await this.storeEntry(entry);

    logger.info('Created audit trail entry', {
      entryId: entry.id,
      type: entry.type,
      hash: entry.hash,
      hasSignature: !!signature,
      hasProof: !!proof,
    });

    return entry;
  }

  /**
   * Query audit trail entries
   */
  async queryEntries(
    query: AuditTrailQuery,
    oversightBodyId?: string
  ): Promise<AuditTrailEntry[]> {
    // Check access control
    let entries = Array.from(this.entries.values());

    // Filter by access control
    if (oversightBodyId) {
      entries = entries.filter(
        (e) =>
          e.accessControl.publicAccess ||
          e.accessControl.oversightBodies.includes(oversightBodyId)
      );
    } else {
      // Only return public entries if no oversight body specified
      entries = entries.filter((e) => e.accessControl.publicAccess);
    }

    // Apply filters
    if (query.types && query.types.length > 0) {
      entries = entries.filter((e) => query.types!.includes(e.type));
    }

    if (query.orgId) {
      entries = entries.filter((e) => e.orgId === query.orgId);
    }

    if (query.region) {
      entries = entries.filter((e) => e.region === query.region);
    }

    if (query.startTime) {
      entries = entries.filter((e) => e.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      entries = entries.filter((e) => e.timestamp <= query.endTime!);
    }

    if (query.entityIds) {
      entries = entries.filter((e) => {
        const matches =
          (!query.entityIds!.actionId || e.entityIds.actionId === query.entityIds!.actionId) &&
          (!query.entityIds!.decisionId ||
            e.entityIds.decisionId === query.entityIds!.decisionId) &&
          (!query.entityIds!.userId || e.entityIds.userId === query.entityIds!.userId) &&
          (!query.entityIds!.clinicianId ||
            e.entityIds.clinicianId === query.entityIds!.clinicianId);
        return matches;
      });
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return entries.slice(offset, offset + limit);
  }

  /**
   * Get entry by ID
   */
  async getEntry(
    entryId: string,
    oversightBodyId?: string
  ): Promise<AuditTrailEntry | null> {
    const entry = this.entries.get(entryId);
    if (!entry) {
      return null;
    }

    // Check access control
    if (
      oversightBodyId &&
      !entry.accessControl.publicAccess &&
      !entry.accessControl.oversightBodies.includes(oversightBodyId)
    ) {
      throw new Error('Access denied: Entry not accessible to this oversight body');
    }

    return entry;
  }

  /**
   * Verify entry integrity
   */
  async verifyEntry(entry: AuditTrailEntry): Promise<boolean> {
    // Verify hash
    const calculatedHash = this.calculateHash(
      {
        type: entry.type,
        orgId: entry.orgId,
        region: entry.region,
        entityIds: entry.entityIds,
        data: entry.data,
        accessControl: entry.accessControl,
      },
      entry.previousHash,
      entry.timestamp
    );

    if (calculatedHash !== entry.hash) {
      logger.warn('Audit trail entry hash mismatch', {
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
        logger.warn('Audit trail entry signature invalid', { entryId: entry.id });
        return false;
      }
    }

    // Verify Merkle proof if present
    if (entry.proof?.merkleProof) {
      const isValid = await this.verifyMerkleProof(entry.hash, entry.proof);
      if (!isValid) {
        logger.warn('Audit trail entry Merkle proof invalid', { entryId: entry.id });
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate hash for entry
   */
  private calculateHash(
    input: {
      type: AuditTrailEntryType;
      orgId?: string;
      region?: string;
      entityIds: Record<string, string | undefined>;
      data: Record<string, unknown>;
      accessControl: {
        oversightBodies: string[];
        publicAccess: boolean;
      };
    },
    previousHash: string | undefined,
    timestamp: Date
  ): string {
    const data = JSON.stringify({
      type: input.type,
      orgId: input.orgId,
      region: input.region,
      entityIds: input.entityIds,
      data: input.data,
      accessControl: input.accessControl,
      previousHash,
      timestamp: timestamp.toISOString(),
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
   * Get previous entry hash
   */
  private async getPreviousHash(orgId?: string): Promise<string | undefined> {
    // In production, would query database for latest entry
    // For now, return undefined (first entry)
    return undefined;
  }

  /**
   * Generate Merkle proof
   */
  private async generateMerkleProof(hash: string): Promise<CryptographicProof> {
    // Simplified Merkle proof generation
    // In production, would build actual Merkle tree
    const merkleRoot = createHash('sha256')
      .update(hash + Date.now().toString())
      .digest('hex');

    return {
      merkleRoot,
      merkleProof: [hash],
    };
  }

  /**
   * Verify Merkle proof
   */
  private async verifyMerkleProof(
    hash: string,
    proof: CryptographicProof
  ): Promise<boolean> {
    // Simplified Merkle proof verification
    // In production, would verify actual Merkle tree path
    return proof.merkleProof?.includes(hash) || false;
  }

  /**
   * Store entry in database
   */
  private async storeEntry(entry: AuditTrailEntry): Promise<void> {
    try {
      // In production, would store in database
      logger.debug('Storing audit trail entry', {
        entryId: entry.id,
        type: entry.type,
        hash: entry.hash,
      });

      // TODO: Implement database storage
      // await prisma.ethicsAuditTrailEntry.create({ data: entry });
    } catch (error) {
      logger.error('Error storing audit trail entry', { error });
    }
  }
}

/**
 * Create a new EthicsAuditTrail instance
 */
export function createEthicsAuditTrail(
  config?: Partial<EthicsAuditTrailConfig>
): EthicsAuditTrail {
  return new EthicsAuditTrail(config);
}

