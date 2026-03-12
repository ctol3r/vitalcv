import {
  NpiRegistryAdapter,
  NursysENotifyAdapter,
  hashSensitiveInput,
  type AdapterDescriptor,
  type CredentialFactBatch,
  type PersistedArtifactStatus,
} from '@vitalcv/psv-adapters';

import { log } from '../../obs/logger';
import { BackendCanonicalCredentialFactStore } from './canonicalFactStore';

type OrchestrationArtifact = Readonly<{
  artifactId: string;
  npi: string;
  source: string;
  sourceUrl: string;
  retrievalTimestampUtc: string;
  checksum: string;
  rawChecksum: string;
  normalizedData: Record<string, unknown>;
  methodologyVersion: string;
  verifierIdentity: string;
  status: PersistedArtifactStatus;
  licenseNumber?: string;
  state?: string;
  expiresAt?: string;
}>;

type OrchestrationResult = Readonly<{
  npi: string;
  artifacts: readonly OrchestrationArtifact[];
  readinessScore: number;
  missingCredentials: readonly string[];
  completedAt: string;
  events: readonly string[];
}>;

function toArtifact(
  batch: CredentialFactBatch,
  artifactId: string,
  idempotent: boolean,
): OrchestrationArtifact {
  return Object.freeze({
    artifactId,
    npi: batch.subjectId,
    source: batch.source,
    sourceUrl: batch.summary.sourceUrl,
    retrievalTimestampUtc: batch.retrievalTime,
    checksum: batch.rawResponseHash,
    rawChecksum: batch.rawResponseHash,
    normalizedData: {
      batchId: batch.batchId,
      idempotencyKey: batch.idempotencyKey,
      factTypes: batch.facts.map((entry) => entry.fact.factType),
      facts: batch.facts,
      events: batch.events,
      idempotent,
    },
    methodologyVersion: batch.adapterVersion,
    verifierIdentity: 'vitalcv-interop-v1',
    status: batch.summary.status,
    ...(batch.summary.licenseNumber ? { licenseNumber: batch.summary.licenseNumber } : {}),
    ...(batch.summary.state ? { state: batch.summary.state } : {}),
    ...(batch.summary.expiresAt ? { expiresAt: batch.summary.expiresAt } : {}),
  });
}

export class PsvInteropService {
  constructor(
    private readonly store = new BackendCanonicalCredentialFactStore(),
    private readonly npiRegistryAdapter = new NpiRegistryAdapter(),
    private readonly nursysAdapter = new NursysENotifyAdapter({
      baseUrl: process.env.NURSYS_BASE_URL?.trim(),
      apiKey: process.env.NURSYS_API_KEY?.trim(),
      institutionId: process.env.NURSYS_INSTITUTION_ID?.trim(),
    }),
  ) {}

  listAdapters(): readonly AdapterDescriptor[] {
    return Object.freeze([
      this.npiRegistryAdapter.descriptor,
      this.nursysAdapter.descriptor,
    ]);
  }

  async orchestrateVerification(
    npi: string,
    requestedSources?: readonly string[],
  ): Promise<OrchestrationResult> {
    const selectedSources = this.resolveSources(requestedSources);
    const artifacts: OrchestrationArtifact[] = [];
    const emittedEvents: string[] = [];

    for (const source of selectedSources) {
      try {
        const batch =
          source === this.npiRegistryAdapter.descriptor.sourceId
            ? await this.npiRegistryAdapter.lookupByNpi(npi)
            : await this.nursysAdapter.pollUpdates({ npi });

        await this.store.recordQueryAudit({
          subjectId: batch.subjectId,
          source: batch.source,
          queryHash: batch.queryHash,
          queryKind: batch.queryKind,
          retrievalMethod:
            source === this.npiRegistryAdapter.descriptor.sourceId ? 'api' : 'polling',
          occurredAt: batch.retrievalTime,
        });

        const persisted = await this.store.persistBatch({
          batch,
        });

        artifacts.push(toArtifact(batch, persisted.artifactId, persisted.idempotent));
        emittedEvents.push(...batch.events.map((event) => event.eventType));
      } catch (error) {
        log('warn', 'psv_interop_source_failed', {
          source,
          subjectHash: hashSensitiveInput(npi),
          error: error instanceof Error ? error.message : String(error),
        });

        artifacts.push(
          Object.freeze({
            artifactId: `error_${source}_${Date.now()}`,
            npi,
            source,
            sourceUrl:
              source === this.npiRegistryAdapter.descriptor.sourceId
                ? 'https://npiregistry.cms.hhs.gov/api/'
                : process.env.NURSYS_BASE_URL?.trim() ?? 'https://api.nursys.com',
            retrievalTimestampUtc: new Date().toISOString(),
            checksum: 'error',
            rawChecksum: 'error',
            normalizedData: {
              error: error instanceof Error ? error.message : String(error),
            },
            methodologyVersion:
              source === this.npiRegistryAdapter.descriptor.sourceId
                ? this.npiRegistryAdapter.descriptor.version
                : this.nursysAdapter.descriptor.version,
            verifierIdentity: 'vitalcv-interop-v1',
            status: 'ERROR',
          }),
        );
      }
    }

    const readinessScore =
      artifacts.length > 0
        ? Math.round((artifacts.filter((artifact) => artifact.status === 'ACTIVE').length / artifacts.length) * 100)
        : 0;

    return Object.freeze({
      npi,
      artifacts: Object.freeze(artifacts),
      readinessScore,
      missingCredentials: Object.freeze(
        artifacts
          .filter((artifact) => artifact.status === 'NOT_FOUND' || artifact.status === 'ERROR')
          .map((artifact) => artifact.source),
      ),
      completedAt: new Date().toISOString(),
      events: Object.freeze([...new Set(emittedEvents)]),
    });
  }

  async getOrchestrationStatus(npi: string) {
    return this.store.getStatus(npi, this.listAdapters().map((adapter) => adapter.sourceId));
  }

  async enrollProviderForMonitoring(npi: string): Promise<void> {
    const batch = await this.nursysAdapter.enrollMonitoring({
      npi,
      institutionId: process.env.NURSYS_INSTITUTION_ID?.trim(),
      deliveryMethod: process.env.NURSYS_WEBHOOK_URL?.trim() ? 'WEBHOOK' : 'POLLING',
      webhookTarget: process.env.NURSYS_WEBHOOK_URL?.trim(),
    });

    await this.store.persistBatch({
      batch,
    });
  }

  async pollNursysUpdates(npi: string, subscriptionId?: string) {
    const batch = await this.nursysAdapter.pollUpdates({
      npi,
      ...(subscriptionId ? { subscriptionId } : {}),
    });
    await this.store.recordQueryAudit({
      subjectId: batch.subjectId,
      source: batch.source,
      queryHash: batch.queryHash,
      queryKind: batch.queryKind,
      retrievalMethod: 'polling',
      occurredAt: batch.retrievalTime,
    });
    return this.store.persistBatch({
      batch,
    });
  }

  async ingestNursysWebhook(subscriptionId: string, payload: unknown) {
    const batch = await this.nursysAdapter.ingestWebhook({
      subscriptionId,
      payload,
    });
    return this.store.persistBatch({
      batch,
    });
  }

  private resolveSources(requestedSources?: readonly string[]): readonly string[] {
    if (requestedSources && requestedSources.length > 0) {
      return Object.freeze(
        this.listAdapters()
          .map((adapter) => adapter.sourceId)
          .filter((sourceId) => requestedSources.includes(sourceId)),
      );
    }

    return Object.freeze([
      this.npiRegistryAdapter.descriptor.sourceId,
      ...(this.nursysAdapter.descriptor.operational
        ? [this.nursysAdapter.descriptor.sourceId]
        : []),
    ]);
  }
}

export const psvInteropService = new PsvInteropService();
