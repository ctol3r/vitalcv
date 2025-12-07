const log = getServiceLogger('pipeline-fhir/index');
/**
 * FHIR Data Pipeline (Spezi-style) for PSV
 *
 * Pipeline stages: ingest → normalize → audit → export
 * Each stage hash is anchored on-chain for immutable audit trail.
 *
 * Task: B119B-FHIRPIPE-012
 */

import { createHash } from 'crypto';
import { PolkadotService } from '../../backend/src/blockchain/polkadot_service';
import { getServiceLogger } from '../logging/serviceLogger';

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: any;
}

export interface PipelineStage {
  stage: 'ingest' | 'normalize' | 'audit' | 'export';
  inputHash?: string;
  outputHash: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PipelineResult {
  pipelineId: string;
  providerId: string;
  npi?: string;
  stages: PipelineStage[];
  merkleRoot?: string;
  anchoredAt?: number;
  txHash?: string;
}

/**
 * Ingest FHIR resources from source
 */
export async function ingestFhirResources(
  source: string,
  resources: FhirResource[]
): Promise<{ resources: FhirResource[]; hash: string }> {
  const payload = JSON.stringify({
    source,
    resources,
    timestamp: Date.now(),
  });

  const hash = createHash('sha256').update(payload).digest('hex');

  log.info(`[FHIR Pipeline] Ingested ${resources.length} resources from ${source}`);

  return { resources, hash };
}

/**
 * Normalize FHIR resources to internal format
 */
export function normalizeFhirResources(
  resources: FhirResource[]
): { normalized: any[]; hash: string } {
  const normalized = resources.map(resource => {
    // Normalize Practitioner resources
    if (resource.resourceType === 'Practitioner') {
      return {
        resourceType: 'Practitioner',
        id: resource.id,
        name: resource.name?.[0] || {},
        identifier: resource.identifier || [],
        telecom: resource.telecom || [],
        address: resource.address || [],
        birthDate: resource.birthDate,
        gender: resource.gender,
      };
    }

    // Normalize PractitionerRole resources
    if (resource.resourceType === 'PractitionerRole') {
      return {
        resourceType: 'PractitionerRole',
        id: resource.id,
        practitioner: resource.practitioner,
        organization: resource.organization,
        code: resource.code || [],
        specialty: resource.specialty || [],
        period: resource.period,
        active: resource.active,
      };
    }

    // Normalize Organization resources
    if (resource.resourceType === 'Organization') {
      return {
        resourceType: 'Organization',
        id: resource.id,
        name: resource.name,
        identifier: resource.identifier || [],
        address: resource.address || [],
        active: resource.active,
      };
    }

    // Default: return as-is
    return resource;
  });

  const payload = JSON.stringify({
    normalized,
    timestamp: Date.now(),
  });

  const hash = createHash('sha256').update(payload).digest('hex');

  log.info(`[FHIR Pipeline] Normalized ${normalized.length} resources`);

  return { normalized, hash };
}

/**
 * Audit normalized resources
 */
export function auditFhirResources(
  normalized: any[]
): { audited: any[]; hash: string } {
  const audited = normalized.map(resource => {
    // Add audit metadata
    return {
      ...resource,
      _audit: {
        verifiedAt: new Date().toISOString(),
        source: 'fhir-pipeline',
        version: '1.0',
      },
    };
  });

  const payload = JSON.stringify({
    audited,
    timestamp: Date.now(),
  });

  const hash = createHash('sha256').update(payload).digest('hex');

  log.info(`[FHIR Pipeline] Audited ${audited.length} resources`);

  return { audited, hash };
}

/**
 * Export audited resources to target format
 */
export function exportFhirResources(
  audited: any[]
): { exported: any[]; hash: string } {
  // Export as FHIR Bundle
  const exported = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: audited.map((resource, index) => ({
      fullUrl: `urn:uuid:${resource.id || `resource-${index}`}`,
      resource,
    })),
  };

  const payload = JSON.stringify({
    exported,
    timestamp: Date.now(),
  });

  const hash = createHash('sha256').update(payload).digest('hex');

  log.info(`[FHIR Pipeline] Exported ${audited.length} resources`);

  return { exported, hash };
}

/**
 * Compute Merkle root from stage hashes
 */
function computeMerkleRoot(stages: PipelineStage[]): string {
  const hashes = stages.map(s => s.outputHash);

  // Simple Merkle tree: hash all stage hashes together
  const combined = hashes.join('');
  return createHash('sha256').update(combined).digest('hex');
}

/**
 * FHIR Pipeline Processor
 */
export class FhirPipelineProcessor {
  private polkadot: PolkadotService;
  private results: Map<string, PipelineResult>;

  constructor() {
    this.polkadot = new PolkadotService();
    this.results = new Map();
  }

  /**
   * Run complete pipeline: ingest → normalize → audit → export
   */
  async processPipeline(
    providerId: string,
    source: string,
    resources: FhirResource[],
    npi?: string
  ): Promise<PipelineResult> {
    const pipelineId = `fhir-pipeline-${providerId}-${Date.now()}`;
    const stages: PipelineStage[] = [];

    log.info(`[FHIR Pipeline] Starting pipeline ${pipelineId} for provider ${providerId}`);

    try {
      // Stage 1: Ingest
      const ingestResult = await ingestFhirResources(source, resources);
      const ingestStage: PipelineStage = {
        stage: 'ingest',
        outputHash: ingestResult.hash,
        timestamp: Date.now(),
        metadata: { source, resourceCount: resources.length },
      };
      stages.push(ingestStage);
      await this.anchorStageHash(ingestStage.outputHash, 'ingest', pipelineId);

      // Stage 2: Normalize
      const normalizeResult = normalizeFhirResources(ingestResult.resources);
      const normalizeStage: PipelineStage = {
        stage: 'normalize',
        inputHash: ingestStage.outputHash,
        outputHash: normalizeResult.hash,
        timestamp: Date.now(),
        metadata: { normalizedCount: normalizeResult.normalized.length },
      };
      stages.push(normalizeStage);
      await this.anchorStageHash(normalizeStage.outputHash, 'normalize', pipelineId);

      // Stage 3: Audit
      const auditResult = auditFhirResources(normalizeResult.normalized);
      const auditStage: PipelineStage = {
        stage: 'audit',
        inputHash: normalizeStage.outputHash,
        outputHash: auditResult.hash,
        timestamp: Date.now(),
        metadata: { auditedCount: auditResult.audited.length },
      };
      stages.push(auditStage);
      await this.anchorStageHash(auditStage.outputHash, 'audit', pipelineId);

      // Stage 4: Export
      const exportResult = exportFhirResources(auditResult.audited);
      const exportStage: PipelineStage = {
        stage: 'export',
        inputHash: auditStage.outputHash,
        outputHash: exportResult.hash,
        timestamp: Date.now(),
        metadata: { exportedCount: exportResult.exported.entry?.length || 0 },
      };
      stages.push(exportStage);
      await this.anchorStageHash(exportStage.outputHash, 'export', pipelineId);

      // Compute Merkle root
      const merkleRoot = computeMerkleRoot(stages);

      // Anchor Merkle root on-chain
      const txHash = await this.polkadot.anchorData(merkleRoot);

      const result: PipelineResult = {
        pipelineId,
        providerId,
        npi,
        stages,
        merkleRoot,
        anchoredAt: Date.now(),
        txHash,
      };

      this.results.set(pipelineId, result);

      log.info(`[FHIR Pipeline] Pipeline ${pipelineId} complete (tx: ${txHash})`);

      return result;
    } catch (error) {
      log.error(`[FHIR Pipeline] Pipeline ${pipelineId} failed:`, error);
      throw error;
    }
  }

  /**
   * Anchor stage hash on-chain
   */
  private async anchorStageHash(
    hash: string,
    stage: string,
    pipelineId: string
  ): Promise<void> {
    try {
      const txHash = await this.polkadot.anchorData(hash);
      log.info(`[FHIR Pipeline] Anchored ${stage} stage hash (tx: ${txHash})`);
    } catch (error) {
      log.error(`[FHIR Pipeline] Failed to anchor ${stage} stage hash:`, error);
      // Continue execution even if anchoring fails (graceful degradation)
    }
  }

  /**
   * Get pipeline result by ID
   */
  getResult(pipelineId: string): PipelineResult | undefined {
    return this.results.get(pipelineId);
  }

  /**
   * Get all pipeline results for a provider
   */
  getProviderResults(providerId: string): PipelineResult[] {
    return Array.from(this.results.values()).filter(r => r.providerId === providerId);
  }
}

// Singleton instance
let processor: FhirPipelineProcessor | null = null;

export function getFhirPipelineProcessor(): FhirPipelineProcessor {
  if (!processor) {
    processor = new FhirPipelineProcessor();
  }
  return processor;
}

