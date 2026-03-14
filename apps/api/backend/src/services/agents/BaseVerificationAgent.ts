/**
 * BaseVerificationAgent.ts
 *
 * Abstract base for all AI verification agents.
 * Subclasses implement fetchEvidence() and detectInconsistencies().
 * The base class handles:
 *   - Timing & status tracking
 *   - VerificationArtifact persistence via EvidenceNormalizer
 *   - Error capture (agents NEVER throw — they return failed status)
 *   - TrustState refresh trigger after artifact creation
 */

import { randomUUID } from 'crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { computeClinicianTrustState } from '../trust/trustStateEngine';
import type {
  AgentName,
  AgentRunResult,
  EvidenceBundle,
  Anomaly,
} from './types';

export abstract class BaseVerificationAgent {
  abstract readonly name: AgentName;
  abstract readonly description: string;

  /**
   * Fetch raw evidence from source systems and return normalized EvidenceBundles.
   * Must NEVER throw — catch all errors internally and return partial results.
   */
  protected abstract fetchEvidence(npi: string): Promise<EvidenceBundle[]>;

  /**
   * Cross-source inconsistency detection.
   * Compare new evidence against existing VerificationArtifacts.
   */
  protected abstract detectInconsistencies(
    npi: string,
    newEvidence: EvidenceBundle[],
  ): Promise<Anomaly[]>;

  /**
   * Run the agent end-to-end for a given NPI.
   * Returns AgentRunResult — never rejects.
   */
  async run(npi: string): Promise<AgentRunResult> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    log('info', `agent[${this.name}]: starting`, { npi });

    try {
      // 1. Fetch evidence from source systems
      const evidenceBundles = await this.fetchEvidence(npi);

      // 2. Detect inconsistencies against existing artifacts
      const anomalies = await this.detectInconsistencies(npi, evidenceBundles);

      // 3. Persist evidence as VerificationArtifacts
      const artifactsCreated = await this.persistEvidence(npi, evidenceBundles);

      // 4. Refresh trust state if we created new artifacts
      let trustStateRefreshed = false;
      if (artifactsCreated > 0) {
        try {
          await computeClinicianTrustState(npi);
          trustStateRefreshed = true;
        } catch (err) {
          log('warn', `agent[${this.name}]: trust state refresh failed`, { npi, err: String(err) });
        }
      }

      const completedAt = new Date().toISOString();
      log('info', `agent[${this.name}]: completed`, {
        npi,
        bundles: evidenceBundles.length,
        anomalies: anomalies.length,
        artifactsCreated,
        durationMs: Date.now() - startMs,
      });

      return {
        agentName: this.name,
        npi,
        status: 'completed',
        startedAt,
        completedAt,
        durationMs: Date.now() - startMs,
        evidenceBundles,
        anomalies,
        artifactsCreated,
        trustStateRefreshed,
      };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log('error', `agent[${this.name}]: failed`, { npi, error });

      return {
        agentName: this.name,
        npi,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        evidenceBundles: [],
        anomalies: [],
        artifactsCreated: 0,
        trustStateRefreshed: false,
        error,
      };
    }
  }

  /** Persist EvidenceBundles as VerificationArtifacts. Returns count created. */
  protected async persistEvidence(npi: string, bundles: EvidenceBundle[]): Promise<number> {
    let created = 0;
    const checksum = (b: EvidenceBundle) =>
      Buffer.from(`${npi}:${b.source}:${b.credentialType}:${b.extractedAt}`).toString('base64');

    for (const bundle of bundles) {
      if (bundle.status === 'UNKNOWN' && bundle.confidence === 'STUB') continue;

      try {
        const expiresAt = bundle.normalizedFields.expiryDate
          ? new Date(bundle.normalizedFields.expiryDate)
          : undefined;

        await prisma.verificationArtifact.create({
          data: {
            npi,
            source: bundle.source,
            status: bundle.status === 'ACTIVE' ? 'VERIFIED' : bundle.status,
            rawPayload: JSON.parse(JSON.stringify({
              ...bundle.rawData,
              _agent: bundle.agentName,
              _confidence: bundle.confidence,
              _extractedAt: bundle.extractedAt,
              credentialType: bundle.credentialType,
              ...bundle.normalizedFields,
            })),
            checksum: checksum(bundle),
            verifiedAt: new Date(bundle.extractedAt),
            ...(expiresAt ? { expiresAt } : {}),
            trustState: bundle.status === 'ACTIVE' ? 'verified' : 'pending',
          },
        });
        created++;
      } catch (err: unknown) {
        // P2002 unique constraint (duplicate checksum) — benign, already persisted
        const code = (err as { code?: string }).code;
        if (code !== 'P2002') {
          log('warn', `agent[${this.name}]: artifact persist failed`, {
            npi, source: bundle.source, error: String(err),
          });
        }
      }
    }
    return created;
  }

  /** Load existing VerificationArtifacts for comparison (inconsistency detection) */
  protected async loadExistingArtifacts(npi: string, sources: string[]) {
    return prisma.verificationArtifact.findMany({
      where: { npi, source: { in: sources } },
      orderBy: { verifiedAt: 'desc' },
      take: 20,
      select: {
        id: true, source: true, status: true, trustState: true,
        rawPayload: true, verifiedAt: true, expiresAt: true,
      },
    });
  }

  /** Build a minimal anomaly object */
  protected anomaly(
    npi: string,
    opts: Omit<Anomaly, 'id' | 'npi' | 'agentName' | 'detectedAt'>,
  ): Anomaly {
    return {
      id: randomUUID(),
      npi,
      agentName: this.name,
      detectedAt: new Date().toISOString(),
      ...opts,
    };
  }
}
