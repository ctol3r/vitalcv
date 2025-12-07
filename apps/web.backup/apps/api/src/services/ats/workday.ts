import { randomUUID } from 'node:crypto';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import type {
  AtsCandidateDelivery,
  AtsConnector,
  AtsConnectorHealth,
  AtsConnectorResponse,
  AtsRoleSummary,
  ConnectorOptions,
  EmployerAtsRecord,
} from './types';
import { buildUnconfiguredResponse, ensureRequestId, normalizeBaseUrl } from './types';

const log = getServiceLogger('api/services/ats/workday');
const DEFAULT_BASE_URL = 'https://services.workday.com/ccx/service/vitalcv/ats/';
const DEFAULT_TIMEOUT = 30_000;

export class WorkdayConnector implements AtsConnector {
  readonly name = 'workday';

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(connection: EmployerAtsRecord, options: ConnectorOptions = {}) {
    this.baseUrl = normalizeBaseUrl(connection.apiUrl, DEFAULT_BASE_URL);
    this.apiKey = connection.apiKey ?? process.env.WORKDAY_ATS_TOKEN ?? undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  async pushCandidate(payload: AtsCandidateDelivery): Promise<AtsConnectorResponse> {
    if (!this.apiKey) {
      return buildUnconfiguredResponse(this.name, 'API token is missing');
    }

    const requestId = ensureRequestId(
      payload.metadata && typeof payload.metadata['requestId'] === 'string'
        ? (payload.metadata['requestId'] as string)
        : undefined,
    );
    const normalized = this.normalizeCandidate(payload);

    try {
      const response = await this.request<Record<string, unknown>>(
        'POST',
        'candidates',
        normalized,
      );
      return {
        delivered: true,
        statusCode: response.status,
        requestId,
        body: response.body,
        message: 'Candidate synced to Workday',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('Workday delivery failed', {
        clinicianId: payload.clinicianId,
        error: message,
      });
      return {
        delivered: false,
        statusCode: 0,
        requestId,
        error: message,
        message: 'Workday delivery failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async fetchOpenRoles(options?: { limit?: number }): Promise<AtsRoleSummary[]> {
    if (!this.apiKey) {
      return this.buildFallbackRoles('missing_token');
    }

    const limit = Math.max(1, Math.min(options?.limit ?? 20, 100));
    try {
      const response = await this.request<{ requisitions?: Record<string, unknown>[] }>(
        'GET',
        `requisitions?status=open&limit=${limit}`,
      );
      const requisitions = Array.isArray(response.body?.requisitions)
        ? response.body?.requisitions
        : [];
      return requisitions.map((record) => this.mapRequisition(record));
    } catch (error) {
      log.warn('Workday requisitions fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.buildFallbackRoles('network_error');
    }
  }

  async getHealth(): Promise<AtsConnectorHealth> {
    const lastChecked = new Date().toISOString();
    if (!this.apiKey) {
      return {
        ok: false,
        lastChecked,
        message: 'API token missing',
      };
    }
    const start = Date.now();
    try {
      await this.request('GET', 'metadata');
      return {
        ok: true,
        lastChecked,
        latencyMs: Date.now() - start,
        message: 'Workday API reachable',
      };
    } catch (error) {
      return {
        ok: false,
        lastChecked,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private normalizeCandidate(payload: AtsCandidateDelivery) {
    const profile = payload.profile ?? {};
    const readiness = payload.readinessScore ?? null;
    const screenings = payload.screening?.components ?? [];

    const readinessBand =
      readiness === null
        ? 'unknown'
        : readiness >= 0.85
          ? 'ready'
          : readiness >= 0.7
            ? 'review'
            : 'manual';

    return {
      candidateId: payload.clinicianId,
      fullName: profile.fullName ?? payload.clinicianId,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      specialty: profile.specialty ?? null,
      location: profile.location ?? null,
      readinessScore: readiness,
      readinessBand,
      screeningSummary: screenings.map((component) => ({
        key: component.key,
        status: component.status,
        detail: component.detail,
        score: component.score ?? null,
      })),
      bundleHash: payload.bundle
        ? hashString(JSON.stringify(payload.bundle)).slice(0, 16)
        : null,
    };
  }

  private mapRequisition(record: Record<string, unknown>): AtsRoleSummary {
    const jobId = record?.id ?? randomUUID();
    return {
      id: String(jobId),
      title: typeof record?.title === 'string' ? record.title : 'Unlabeled requisition',
      location: typeof record?.location === 'string' ? record.location : undefined,
      department: typeof record?.department === 'string' ? record.department : undefined,
      openings:
        typeof record?.openings === 'number'
          ? (record.openings as number)
          : (record?.openings as string | undefined)
            ? Number(record.openings)
            : undefined,
      updatedAt: typeof record?.updatedAt === 'string' ? record.updatedAt : undefined,
      raw: record,
    };
  }

  private buildFallbackRoles(reason: string): AtsRoleSummary[] {
    return [
      {
        id: `demo-workday-1-${reason}`,
        title: 'Director of Telehealth Nursing',
        location: 'Remote',
        department: 'Operations',
        openings: 1,
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        raw: { reason },
      },
      {
        id: `demo-workday-2-${reason}`,
        title: 'Physician Advisor · Revenue Integrity',
        location: 'Chicago, IL',
        department: 'Medical Staff',
        openings: 2,
        updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        raw: { reason },
      },
    ];
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: T | null }> {
    if (!this.baseUrl) {
      throw new Error('Workday base URL is not configured');
    }
    const url = new URL(path.replace(/^\//, ''), this.baseUrl).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'User-Agent': 'VitalCV-ATS-Bridge/3.0',
      };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = text ? tryParseJson<T>(text) : null;
      if (!response.ok) {
        throw new Error(
          `Workday responded with ${response.status}: ${
            typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
          }`,
        );
      }
      return { status: response.status, body: parsed };
    } finally {
      clearTimeout(timer);
    }
  }
}

function tryParseJson<T>(value: string): T | string {
  try {
    return JSON.parse(value) as T;
  } catch {
    return value;
  }
}

function hashString(input: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  let hash = 0;
  for (let i = 0; i < data.length; i += 1) {
    hash = (hash << 5) - hash + data[i]!;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function createWorkdayConnector(
  connection: EmployerAtsRecord,
  options?: ConnectorOptions,
): AtsConnector {
  return new WorkdayConnector(connection, options);
}









