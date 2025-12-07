import { randomUUID } from 'node:crypto';
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

const DEFAULT_TIMEOUT = 30_000;

export interface WorkdayOnboardingRequest {
  clinicianId: string;
  orgId?: string;
  jobId?: string;
  profile: {
    fullName: string;
    email?: string;
    phone?: string;
    location?: string;
    specialty?: string;
  };
  compensationBand?: string;
  access?: {
    ehrRole?: string;
    badgeLevel?: 'visitor' | 'contractor' | 'employee';
    sites?: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface WorkdayOnboardingResult {
  workerId: string;
  requisitionLinkId: string;
  accessRequestId: string;
  steps: HrisConnectorTestStep[];
  region: string;
  log: HrisSyncLogEntry;
}

export class WorkdayOnboardingConnectorV2 {
  private readonly connection: HrisConnectionRecord;

  private readonly fetchImpl: typeof fetch;

  private readonly timeoutMs: number;

  private readonly endpoints: RegionEndpoint[];

  constructor(connection: HrisConnectionRecord, options: HrisConnectorOptions = {}) {
    this.connection = connection;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    this.endpoints = resolveRegionEndpoints(connection.endpoint, options.regionEndpoints);
  }

  async onboardWorker(request: WorkdayOnboardingRequest): Promise<WorkdayOnboardingResult> {
    const startedAt = new Date();
    const steps: HrisConnectorTestStep[] = [];

    try {
      const attempt = await executeWithRegionFallback(this.endpoints, async (endpoint) => {
        const worker = await this.measureStep('Create worker profile', steps, () =>
          this.createWorkerProfile(endpoint, request),
        );
        const requisition = await this.measureStep('Link requisition', steps, () =>
          this.linkJobRequisition(endpoint, worker.workerId, request),
        );
        const access = await this.measureStep('Request access', steps, () =>
          this.createAccessTicket(endpoint, worker.workerId, request),
        );

        return {
          region: endpoint.region,
          worker,
          requisition,
          access,
        };
      });

      const completedAt = new Date();
      const log = recordHrisSyncLog({
        orgId: this.connection.orgId,
        vendor: normalizeVendorType(this.connection.type),
        action: 'workday.onboardWorker',
        status: 'success',
        attempts: attempt.attempts.length,
        region: attempt.region,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        connectionId: this.connection.id,
        metadata: {
          workerId: attempt.result.worker.workerId,
          requisitionLinkId: attempt.result.requisition.linkId,
          accessRequestId: attempt.result.access.accessRequestId,
          latencyMs: completedAt.getTime() - startedAt.getTime(),
        },
      });

      return {
        workerId: attempt.result.worker.workerId,
        requisitionLinkId: attempt.result.requisition.linkId,
        accessRequestId: attempt.result.access.accessRequestId,
        steps,
        region: attempt.region,
        log,
      };
    } catch (error) {
      const completedAt = new Date();
      recordHrisSyncLog({
        orgId: this.connection.orgId,
        vendor: normalizeVendorType(this.connection.type),
        action: 'workday.onboardWorker',
        status: 'failed',
        attempts: steps.length === 0 ? 0 : steps.filter((step) => step.status === 'pass').length + 1,
        region: steps.at(-1)?.detail ?? null,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        connectionId: this.connection.id,
        message: 'Workday onboarding connector failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async testConnection(): Promise<HrisConnectorTestResult> {
    const startedAt = new Date();
    const steps: HrisConnectorTestStep[] = [];
    try {
      const attempt = await executeWithRegionFallback(this.endpoints, async (endpoint) => {
        return this.measureStep('Metadata ping', steps, () => this.request('GET', endpoint, 'metadata'));
      });
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
        message: 'Workday API reachable',
        steps,
      };
    } catch (error) {
      const completedAt = new Date();
      steps.push({
        name: 'Metadata ping',
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

  private async createWorkerProfile(endpoint: RegionEndpoint, request: WorkdayOnboardingRequest) {
    const payload = {
      workerId: randomUUID(),
      name: request.profile.fullName,
      email: request.profile.email ?? null,
      phone: request.profile.phone ?? null,
      location: request.profile.location ?? null,
      specialty: request.profile.specialty ?? null,
      orgId: request.orgId ?? this.connection.orgId,
      compensationBand: request.compensationBand ?? 'default',
      metadata: request.metadata ?? {},
    };
    const response = await this.request('POST', endpoint, 'workers', payload);
    return {
      workerId: response?.workerId ?? payload.workerId,
      body: response,
    };
  }

  private async linkJobRequisition(
    endpoint: RegionEndpoint,
    workerId: string,
    request: WorkdayOnboardingRequest,
  ) {
    const payload = {
      workerId,
      jobId: request.jobId ?? 'unassigned',
      appliedAt: new Date().toISOString(),
      notes: `Linked via VitalCV HRIS (${request.profile.fullName})`,
    };
    const response = await this.request('POST', endpoint, 'requisitions/link', payload);
    return {
      linkId: response?.linkId ?? randomUUID(),
      body: response,
    };
  }

  private async createAccessTicket(
    endpoint: RegionEndpoint,
    workerId: string,
    request: WorkdayOnboardingRequest,
  ) {
    const payload = {
      workerId,
      ehrRole: request.access?.ehrRole ?? 'general',
      badgeLevel: request.access?.badgeLevel ?? 'contractor',
      sites: request.access?.sites ?? [],
      requestedAt: new Date().toISOString(),
    };
    const response = await this.request('POST', endpoint, 'access/requests', payload);
    return {
      accessRequestId: response?.accessRequestId ?? randomUUID(),
      body: response,
    };
  }

  private async request(
    method: string,
    endpoint: RegionEndpoint,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<any> {
    if (!endpoint.endpoint) {
      throw new Error('workday_endpoint_missing');
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
          'User-Agent': 'VitalCV-HRIS/2.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = text ? parseJson(text) : null;
      if (!response.ok) {
        throw new Error(
          `workday_${response.status}: ${
            typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {})
          }`,
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


