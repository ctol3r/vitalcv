import { createHash, randomUUID } from 'crypto';
import { Prisma, PrismaClient, EvidencePack as EvidencePackModel } from '@prisma/client';
import { PrismaClient as DefaultClient } from '@prisma/client';
import { anchorEvidencePack } from '../audit/anchor';
import { RenewalTimelineBuilder, type RenewalTimelineSnapshot } from './renewal-timeline';

const prisma = new DefaultClient();

export type LifecycleEvidencePackType = 'lifecycle-audit' | 'lifecycle-retirement';

export interface LifecycleEvidencePackPayload {
  packId: string;
  packType: LifecycleEvidencePackType;
  clinicianId: string;
  generatedAt: string;
  items: LifecycleEvidencePackItem[];
  summary: {
    lifecyclePhase: string | null;
    licenseCount: number;
    alerts: number;
    evidenceItems: number;
  };
  timeline: RenewalTimelineSnapshot;
}

export interface LifecycleEvidencePackItem {
  key: string;
  label: string;
  type: string;
  capturedAt: string | null;
  source: string;
  hash: string;
  payload: Record<string, unknown>;
}

export interface LifecycleEvidencePackResult {
  record: EvidencePackModel;
  payload: LifecycleEvidencePackPayload;
}

interface BuildOptions {
  now?: Date;
  prisma?: PrismaClient;
}

export class LifecycleEvidencePackBuilder {
  private readonly timeline: RenewalTimelineBuilder;

  constructor(private readonly db: PrismaClient = prisma, timeline?: RenewalTimelineBuilder) {
    this.timeline = timeline ?? new RenewalTimelineBuilder(db);
  }

  async build(
    clinicianId: string,
    packType: LifecycleEvidencePackType,
    options: BuildOptions = {},
  ): Promise<LifecycleEvidencePackResult> {
    const now = options.now ?? new Date();
    const client = options.prisma ?? this.db;

    const [timelineSnapshot, lifecycle, credentials, readinessSignals, latestProviderTask] =
      await Promise.all([
        this.timeline.build(clinicianId, { now, prisma: client }),
        client.providerLifecycle.findFirst({
          where: { clinicianId },
          orderBy: { updatedAt: 'desc' },
        }),
        client.walletCredential.findMany({
          where: { clinicianId },
          orderBy: { issuedAt: 'desc' },
          take: 50,
        }),
        client.readinessSignal.findMany({
          where: { clinicianId },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        }),
        client.readinessSignal.findFirst({
          where: { clinicianId, type: 'license' },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

    const licenseTasks = extractTasks(latestProviderTask);
    const items: LifecycleEvidencePackItem[] = [
      makeItem({
        key: 'provider-lifecycle',
        label: 'Provider lifecycle snapshot',
        type: 'lifecycle.snapshot',
        capturedAt: lifecycle?.updatedAt.toISOString() ?? timelineSnapshot.generatedAt,
        source: 'provider_lifecycle_engine',
        payload: {
          phase: lifecycle?.phase ?? 'unknown',
          metadata: lifecycle?.metadata ?? {},
          updatedAt: lifecycle?.updatedAt?.toISOString() ?? null,
        },
      }),
      makeItem({
        key: 'renewal-timeline',
        label: 'Renewal automation timeline',
        type: 'lifecycle.timeline',
        capturedAt: timelineSnapshot.generatedAt,
        source: 'renewal_timeline_builder',
        payload: timelineSnapshot,
      }),
      makeItem({
        key: 'high-risk-alerts',
        label: 'High-risk lifecycle alerts',
        type: 'lifecycle.alerts',
        capturedAt: timelineSnapshot.generatedAt,
        source: 'renewal_timeline_builder',
        payload: {
          alerts: timelineSnapshot.alerts,
        },
      }),
      makeItem({
        key: 'wallet-credential-inventory',
        label: 'Wallet credential inventory',
        type: 'wallet.credentials',
        capturedAt: credentials[0]?.updatedAt?.toISOString() ?? null,
        source: 'wallet_service',
        payload: {
          total: credentials.length,
          credentials: credentials.map((credential) => ({
            credentialId: credential.credentialId,
            type: credential.type,
            issuedAt: credential.issuedAt.toISOString(),
            revokedAt: credential.revokedAt?.toISOString() ?? null,
            anchor: (credential.payload as Record<string, unknown> | null)?.['anchorTxHash'] ?? null,
          })),
        },
      }),
    ];

    if (licenseTasks.length) {
      items.push(
        makeItem({
          key: 'license-readiness',
          label: 'License readiness tasks',
          type: 'readiness.tasks',
          capturedAt: latestProviderTask?.updatedAt?.toISOString() ?? now.toISOString(),
          source: 'readiness_signal',
          payload: { tasks: licenseTasks },
        }),
      );
    }

    if (readinessSignals.length) {
      items.push(
        makeItem({
          key: 'readiness-signals',
          label: 'Readiness signal ledger',
          type: 'readiness.signals',
          capturedAt: readinessSignals[0]?.updatedAt?.toISOString() ?? null,
          source: 'readiness_signal',
          payload: {
            signals: readinessSignals.map((signal) => ({
              id: signal.id,
              type: signal.type,
              score: signal.score,
              updatedAt: signal.updatedAt?.toISOString?.() ?? signal.createdAt.toISOString(),
              metadata: signal.metadata,
            })),
          },
        }),
      );
    }

    const payload: LifecycleEvidencePackPayload = {
      packId: `${packType}-${randomUUID()}`,
      packType,
      clinicianId,
      generatedAt: now.toISOString(),
      items,
      summary: {
        lifecyclePhase: lifecycle?.phase ?? null,
        licenseCount: timelineSnapshot.cycleSummary.licenseCount,
        alerts: timelineSnapshot.alerts.length,
        evidenceItems: items.length,
      },
      timeline: timelineSnapshot,
    };

    const record = await client.evidencePack.create({
      data: {
        id: payload.packId,
        clinicianId,
        items: payload as Prisma.InputJsonValue,
      },
    });

    anchorEvidencePack({
      clinicianId,
      packId: payload.packId,
      packType,
      packHash: hashPayload(payload),
      warnings: timelineSnapshot.alerts.map((alert) => alert.label),
      generatedAt: payload.generatedAt,
    });

    return { record, payload };
  }
}

function makeItem(input: Omit<LifecycleEvidencePackItem, 'hash'>): LifecycleEvidencePackItem {
  const payload = sanitizeJson(input.payload);
  return {
    ...input,
    payload,
    hash: hashPayload({ type: input.type, payload }),
  };
}

function sanitizeJson<T = Record<string, unknown>>(value: unknown): T {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function extractTasks(signal?: { metadata: Prisma.JsonValue | null }): Array<Record<string, unknown>> {
  if (!signal?.metadata || typeof signal.metadata !== 'object') {
    return [];
  }
  const record = signal.metadata as Record<string, unknown>;
  const tasks = record['licenseTasks'];
  if (!Array.isArray(tasks)) {
    return [];
  }
  return tasks.filter((entry): entry is Record<string, unknown> => Boolean(entry));
}


