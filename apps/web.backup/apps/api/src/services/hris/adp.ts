import { PrismaClient } from '@prisma/client';
import { executeWithRegionFallback } from './fallback';
import { recordHrisSyncLog } from './logs';
import {
  HrisConnectionRecord,
  HrisConnectorOptions,
  HrisConnectorTestResult,
  HrisConnectorTestStep,
  RegionEndpoint,
  normalizeVendorType,
  resolveRegionEndpoints,
} from './types';

const DEFAULT_TIMEOUT = 20_000;

export interface AdpProfileSyncRequest {
  clinicianId: string;
  orgId?: string;
  includeDocuments?: boolean;
}

export class AdpProfileSyncService {
  private readonly connection: HrisConnectionRecord;

  private readonly fetchImpl: typeof fetch;

  private readonly timeoutMs: number;

  private readonly prisma: PrismaClient;

  private readonly endpoints: RegionEndpoint[];

  constructor(connection: HrisConnectionRecord, options: HrisConnectorOptions = {}) {
    this.connection = connection;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    this.prisma = options.prisma ?? new PrismaClient();
    this.endpoints = resolveRegionEndpoints(connection.endpoint, options.regionEndpoints);
  }

  async syncProfile(request: AdpProfileSyncRequest) {
    const startedAt = new Date();
    const profile = await this.prisma.clinicianProfile.findUnique({
      where: { id: request.clinicianId },
      include: {
        user: { select: { name: true, email: true } },
      },
    });
    if (!profile) {
      throw new Error(`clinician_${request.clinicianId}_not_found`);
    }

    const readiness = await this.prisma.clinicianReadinessScore.findUnique({
      where: { clinicianId: request.clinicianId },
    });

    const [licenses, compacts] = await Promise.all([
      this.prisma.stateLicenseVerification.findMany({
        where: { clinicianId: request.clinicianId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.compactEligibility.findMany({
        where: { clinicianId: request.clinicianId, eligible: true },
      }),
    ]);

    const payload = {
      worker: {
        clinicianId: profile.id,
        name: profile.user?.name ?? profile.id,
        email: profile.user?.email ?? null,
        specialty: profile.specialty ?? null,
        orgId: request.orgId ?? profile.orgId ?? this.connection.orgId,
        readinessScore: readiness?.score ?? null,
        readinessBand: deriveReadinessBand(readiness?.score ?? null),
      },
      credentials: {
        licenses: licenses.map((license) => ({
          state: license.state,
          status: license.status,
          expiresAt: license.expiryDate?.toISOString() ?? null,
        })),
        compacts: compacts.map((record) => record.compact),
      },
      documents:
        request.includeDocuments === false
          ? []
          : await this.prisma.custodyRecord
              .findMany({
                where: { clinicianId: request.clinicianId },
                orderBy: { timestamp: 'desc' },
                take: 50,
              })
              .then((records) =>
                records.map((record) => ({
                  documentId: record.documentId,
                  action: record.action,
                  timestamp: record.timestamp.toISOString(),
                })),
              ),
    };

    const attempt = await executeWithRegionFallback(this.endpoints, async (endpoint) =>
      this.request('PUT', endpoint, `profiles/${request.clinicianId}`, payload),
    );

    recordHrisSyncLog({
      orgId: this.connection.orgId,
      vendor: normalizeVendorType(this.connection.type),
      action: 'adp.syncProfile',
      status: 'success',
      attempts: attempt.attempts.length,
      region: attempt.region,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      connectionId: this.connection.id,
      metadata: {
        clinicianId: request.clinicianId,
        response: attempt.result,
      },
    });

    return {
      clinicianId: request.clinicianId,
      response: attempt.result,
    };
  }

  async testConnection(): Promise<HrisConnectorTestResult> {
    const startedAt = new Date();
    const steps: HrisConnectorTestStep[] = [];
    try {
      const attempt = await executeWithRegionFallback(this.endpoints, async (endpoint) =>
        this.measureStep('Profile ping', steps, () => this.request('GET', endpoint, 'health')),
      );
      const completedAt = new Date();
      return {
        connectionId: this.connection.id,
        orgId: this.connection.orgId,
        vendor: normalizeVendorType(this.connection.type),
        status: 'pass',
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        region: attempt.region,
        message: 'ADP profile API healthy',
        steps,
      };
    } catch (error) {
      const completedAt = new Date();
      steps.push({
        name: 'Profile ping',
        status: 'fail',
        detail: error instanceof Error ? error.message : String(error),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      });
      return {
        connectionId: this.connection.id,
        orgId: this.connection.orgId,
        vendor: normalizeVendorType(this.connection.type),
        status: 'fail',
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        message: error instanceof Error ? error.message : String(error),
        steps,
      };
    }
  }

  private async request(
    method: string,
    endpoint: RegionEndpoint,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<any> {
    if (!endpoint.endpoint) {
      throw new Error('adp_endpoint_missing');
    }
    const url = new URL(path.replace(/^\//, ''), endpoint.endpoint).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.connection.secret}`,
          'Content-Type': 'application/json',
          'User-Agent': 'VitalCV-HRIS-ADP/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = text ? parseJson(text) : null;
      if (!response.ok) {
        throw new Error(
          `adp_${response.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {})}`,
        );
      }
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }

  private async measureStep<T>(
    name: string,
    steps: HrisConnectorTestStep[],
    handler: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await handler();
      steps.push({
        name,
        status: 'pass',
        detail: 'ok',
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      steps.push({
        name,
        status: 'fail',
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}

function parseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function deriveReadinessBand(score: number | null): 'ready' | 'review' | 'manual' | 'unknown' {
  if (score === null || Number.isNaN(score)) {
    return 'unknown';
  }
  if (score >= 0.85) return 'ready';
  if (score >= 0.7) return 'review';
  return 'manual';
}


