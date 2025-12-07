import { PrismaClient } from '@prisma/client';
import { filterCliniciansForShift } from '../scheduling/filter';
import { executeWithRegionFallback } from './fallback';
import { recordHrisSyncLog } from './logs';
import {
  HrisConnectionRecord,
  HrisConnectorOptions,
  HrisConnectorTestResult,
  HrisConnectorTestStep,
  HrisSyncLogEntry,
  RegionEndpoint,
  normalizeVendorType,
  resolveRegionEndpoints,
} from './types';

const DEFAULT_TIMEOUT = 25_000;

export interface UkgShiftSyncRequest {
  shiftId: string;
  orgId?: string;
  limit?: number;
}

export interface UkgShiftSyncResult {
  shiftId: string;
  syncedClinicians: number;
  region: string;
  log: HrisSyncLogEntry;
  payloadPreview: Record<string, unknown>;
}

export class UkgShiftEligibilitySync {
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

  async syncCompactEligibility(request: UkgShiftSyncRequest): Promise<UkgShiftSyncResult> {
    const startedAt = new Date();
    const run = await filterCliniciansForShift({
      shiftId: request.shiftId,
      limit: request.limit ?? 40,
      prisma: this.prisma,
    });

    const payload = {
      shiftId: run.requirement.shiftId,
      orgId: run.requirement.orgId ?? this.connection.orgId,
      readinessThreshold: run.readinessThreshold,
      generatedAt: startedAt.toISOString(),
      clinicians: run.clinicians.map((clinician) => ({
        clinicianId: clinician.clinicianId,
        readinessScore: clinician.readinessScore,
        compactEligible: clinician.compactSummary.eligible,
        missingCompacts: clinician.compactSummary.missing,
        licenseStates: clinician.licenseStates.covered,
        privilegeCodes: clinician.privilegeSummary.satisfied,
        eligible: clinician.eligible,
      })),
    };

    const attempt = await executeWithRegionFallback(this.endpoints, async (endpoint) =>
      this.request('POST', endpoint, 'scheduling/eligibility', payload),
    );

    const log = recordHrisSyncLog({
      orgId: this.connection.orgId,
      vendor: normalizeVendorType(this.connection.type),
      action: 'ukg.syncEligibility',
      status: 'success',
      attempts: attempt.attempts.length,
      region: attempt.region,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      connectionId: this.connection.id,
      metadata: {
        clinicianCount: payload.clinicians.length,
        response: attempt.result,
      },
    });

    return {
      shiftId: payload.shiftId,
      syncedClinicians: payload.clinicians.length,
      region: attempt.region,
      log,
      payloadPreview: {
        clinicianCount: payload.clinicians.length,
        generatedAt: payload.generatedAt,
      },
    };
  }

  async testConnection(): Promise<HrisConnectorTestResult> {
    const startedAt = new Date();
    const steps: HrisConnectorTestStep[] = [];
    try {
      const attempt = await executeWithRegionFallback(this.endpoints, async (endpoint) =>
        this.measureStep('Eligibility ping', steps, () => this.request('GET', endpoint, 'health')),
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
        message: 'UKG scheduling endpoint healthy',
        steps,
      };
    } catch (error) {
      const completedAt = new Date();
      steps.push({
        name: 'Eligibility ping',
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
      throw new Error('ukg_endpoint_missing');
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
          'User-Agent': 'VitalCV-HRIS-UKG/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = text ? parseJson(text) : null;
      if (!response.ok) {
        throw new Error(
          `ukg_${response.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {})}`,
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


