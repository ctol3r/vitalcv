const log = getServiceLogger('audit/fhir-pipeline-audit');
/**
 * Audit anchoring for FHIR pipeline events
 *
 * Each stage hash is anchored on-chain; Merkle root is computed and stored.
 *
 * Task: B119B-AUD-020
 * Acceptance: each stage hash anchored; Merkle root stored
 */

import { createHash } from 'crypto';
import { PolkadotService } from '../../backend/src/blockchain/polkadot_service';
import { AuditScrapbook } from '../../backend/src/blockchain/audit_scrapbook';
import { getServiceLogger } from '../logging/serviceLogger';

export interface PipelineStageHash {
  stage: 'ingest' | 'normalize' | 'audit' | 'export';
  hash: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AuditAnchoringResult {
  pipelineId: string;
  stageHashes: PipelineStageHash[];
  merkleRoot: string;
  anchoredAt: number;
  txHashes: string[];
}

/**
 * Compute Merkle root from stage hashes
 * Uses a simple binary Merkle tree construction
 */
function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    throw new Error('Cannot compute Merkle root from empty hash array');
  }

  if (hashes.length === 1) {
    return hashes[0];
  }

  // Build binary Merkle tree
  let currentLevel = hashes.map(h => Buffer.from(h, 'hex'));

  while (currentLevel.length > 1) {
    const nextLevel: Buffer[] = [];

    // Process pairs
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Pair: hash(left || right)
        const combined = Buffer.concat([currentLevel[i], currentLevel[i + 1]]);
        const hash = createHash('sha256').update(combined).digest();
        nextLevel.push(hash);
      } else {
        // Odd number: hash(node || node)
        const combined = Buffer.concat([currentLevel[i], currentLevel[i]]);
        const hash = createHash('sha256').update(combined).digest();
        nextLevel.push(hash);
      }
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0].toString('hex');
}

/**
 * FHIR Pipeline Audit Anchoring Service
 */
export class FhirPipelineAuditService {
  private polkadot: PolkadotService;
  private auditScrapbook: AuditScrapbook;
  private anchoredResults: Map<string, AuditAnchoringResult>;

  constructor() {
    this.polkadot = new PolkadotService();
    this.auditScrapbook = new AuditScrapbook(this.polkadot);
    this.anchoredResults = new Map();
  }

  /**
   * Anchor FHIR pipeline stage hashes and compute Merkle root
   */
  async anchorPipelineStages(
    pipelineId: string,
    stageHashes: PipelineStageHash[]
  ): Promise<AuditAnchoringResult> {
    log.info(`[FHIR Audit] Anchoring pipeline ${pipelineId} with ${stageHashes.length} stages`);

    const txHashes: string[] = [];

    try {
      // Anchor each stage hash individually
      for (const stageHash of stageHashes) {
        try {
          const txHash = await this.polkadot.anchorData(stageHash.hash);
          txHashes.push(txHash);

          // Record in AuditScrapbook
          await this.auditScrapbook.recordIdentityAction(
            pipelineId,
            `fhir_pipeline_${stageHash.stage}:${stageHash.hash}`
          );

          log.info(`[FHIR Audit] Anchored ${stageHash.stage} stage (tx: ${txHash})`);
        } catch (error) {
          log.error(`[FHIR Audit] Failed to anchor ${stageHash.stage} stage:`, error);
          // Continue with other stages even if one fails
        }
      }

      // Compute Merkle root from all stage hashes
      const hashStrings = stageHashes.map(sh => sh.hash);
      const merkleRoot = computeMerkleRoot(hashStrings);

      // Anchor Merkle root
      let merkleRootTxHash: string;
      try {
        merkleRootTxHash = await this.polkadot.anchorData(merkleRoot);
        txHashes.push(merkleRootTxHash);

        // Record Merkle root in AuditScrapbook
        await this.auditScrapbook.recordIdentityAction(
          pipelineId,
          `fhir_pipeline_merkle_root:${merkleRoot}`
        );

        log.info(`[FHIR Audit] Anchored Merkle root (tx: ${merkleRootTxHash})`);
      } catch (error) {
        log.error(`[FHIR Audit] Failed to anchor Merkle root:`, error);
        merkleRootTxHash = `failed-${Date.now()}`;
      }

      const result: AuditAnchoringResult = {
        pipelineId,
        stageHashes,
        merkleRoot,
        anchoredAt: Date.now(),
        txHashes,
      };

      this.anchoredResults.set(pipelineId, result);

      log.info(`[FHIR Audit] Pipeline ${pipelineId} audit anchoring complete`);

      return result;
    } catch (error) {
      log.error(`[FHIR Audit] Failed to anchor pipeline ${pipelineId}:`, error);
      throw error;
    }
  }

  /**
   * Get audit anchoring result by pipeline ID
   */
  getResult(pipelineId: string): AuditAnchoringResult | undefined {
    return this.anchoredResults.get(pipelineId);
  }

  /**
   * Verify Merkle root matches stage hashes
   */
  verifyMerkleRoot(
    stageHashes: PipelineStageHash[],
    expectedMerkleRoot: string
  ): boolean {
    const hashStrings = stageHashes.map(sh => sh.hash);
    const computedRoot = computeMerkleRoot(hashStrings);
    return computedRoot === expectedMerkleRoot;
  }
}

// Singleton instance
let auditService: FhirPipelineAuditService | null = null;

export function getFhirPipelineAuditService(): FhirPipelineAuditService {
  if (!auditService) {
    auditService = new FhirPipelineAuditService();
  }
  return auditService;
}

