import { Buffer } from 'node:buffer';
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
  ScreeningComponent,
} from './types';
import {
  buildUnconfiguredResponse,
  ensureRequestId,
  normalizeBaseUrl,
  SCREENING_COMPONENT_KEYS,
} from './types';

const log = getServiceLogger('api/services/ats/greenhouse');
const DEFAULT_BASE_URL = 'https://harvest.greenhouse.io/v1/';
const DEFAULT_TIMEOUT = 25_000;

export class GreenhouseConnector implements AtsConnector {
  readonly name = 'greenhouse';

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(connection: EmployerAtsRecord, options: ConnectorOptions = {}) {
    this.baseUrl = normalizeBaseUrl(connection.apiUrl, DEFAULT_BASE_URL);
    this.apiKey = connection.apiKey ?? process.env.GREENHOUSE_API_KEY ?? undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  async pushCandidate(payload: AtsCandidateDelivery): Promise<AtsConnectorResponse> {
    if (!this.apiKey) {
      return buildUnconfiguredResponse(this.name, 'API key is missing');
    }

    const requestId = ensureRequestId(
      payload.metadata && typeof payload.metadata['requestId'] === 'string'
        ? (payload.metadata['requestId'] as string)
        : undefined,
    );
    const normalized = this.normalizeCandidatePayload(payload);

    try {
      const response = await this.request<Record<string, unknown>>(
        'POST',
        'applications',
        normalized,
      );
      return {
        delivered: true,
        statusCode: response.status,
        requestId,
        body: response.body,
        message: 'Candidate delivered to Greenhouse',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('Greenhouse delivery failed', {
        clinicianId: payload.clinicianId,
        error: message,
      });
      return {
        delivered: false,
        statusCode: 0,
        requestId,
        error: message,
        message: 'Greenhouse delivery failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async fetchOpenRoles(options?: { limit?: number }): Promise<AtsRoleSummary[]> {
    if (!this.apiKey) {
      return this.buildFallbackRoles('missing_api_key');
    }

    const perPage = Math.max(1, Math.min(options?.limit ?? 25, 100));
    try {
      const response = await this.request<{ jobs?: Record<string, unknown>[] }>(
        'GET',
        `jobs?status=open&per_page=${perPage}`,
      );
      const jobs = Array.isArray(response.body?.jobs) ? response.body?.jobs : [];
      return jobs.map((job) => this.mapJobRecord(job));
    } catch (error) {
      log.warn('Greenhouse jobs fetch failed', {
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
        message: 'API key is not configured',
      };
    }
    const start = Date.now();
    try {
      await this.request('GET', 'users?page=1&per_page=1');
      return {
        ok: true,
        lastChecked,
        latencyMs: Date.now() - start,
        message: 'Greenhouse Harvest API reachable',
      };
    } catch (error) {
      return {
        ok: false,
        lastChecked,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private normalizeCandidatePayload(payload: AtsCandidateDelivery) {
    const profile = payload.profile ?? {};
    const components = payload.screening?.components ?? [];
    const componentMap = new Map<string, ScreeningComponent>();
    components.forEach((component) => componentMap.set(component.key, component));

    const [firstName, ...rest] = (profile.fullName ?? payload.clinicianId).split(' ');
    const lastName = rest.length > 0 ? rest.join(' ') : 'Candidate';

    const customFields: Record<string, unknown> = {
      readiness_score: payload.readinessScore ?? null,
      screening_verdict: payload.screening?.verdict ?? null,
      specialty: profile.specialty ?? null,
      location: profile.location ?? null,
    };
    SCREENING_COMPONENT_KEYS.forEach((key) => {
      const component = componentMap.get(key);
      if (component) {
        customFields[`${key}_status`] = component.status;
        customFields[`${key}_detail`] = component.detail;
      }
    });

    return {
      external_id: payload.clinicianId,
      first_name: firstName ?? payload.clinicianId,
      last_name: lastName,
      emails: profile.email
        ? [{ value: profile.email, type: 'work' as const, primary: true }]
        : [],
      phone_numbers: profile.phone
        ? [{ value: profile.phone, type: 'mobile' as const, primary: true }]
        : [],
      applications: [
        {
          status: 'prospect',
          job_id:
            payload.metadata && typeof payload.metadata['jobId'] === 'string'
              ? (payload.metadata['jobId'] as string)
              : undefined,
          custom_fields: customFields,
        },
      ],
      attachments: payload.bundle
        ? [
            {
              type: 'json',
              filename: `vitalcv-${payload.clinicianId}.json`,
              content: Buffer.from(JSON.stringify(payload.bundle)).toString('base64'),
            },
          ]
        : [],
      tags: ['vitalcv', payload.orgId ?? ''],
      notes:
        payload.metadata && Array.isArray(payload.metadata['notes'])
          ? (payload.metadata['notes'] as string[])
          : [],
    };
  }

  private mapJobRecord(job: Record<string, unknown>): AtsRoleSummary {
    return {
      id: String(job.id ?? randomUUID()),
      title: typeof job?.name === 'string' ? job.name : 'Unlabeled role',
      location: job?.location && typeof job.location === 'object'
        ? ((job.location as Record<string, unknown>)?.name as string | undefined) ?? undefined
        : undefined,
      department:
        job?.departments && Array.isArray(job.departments) && job.departments[0]
          ? String((job.departments[0] as Record<string, unknown>)?.name ?? '')
          : undefined,
      openings:
        typeof job?.openings === 'number'
          ? (job.openings as number)
          : (job?.openings as string | undefined)
            ? Number(job.openings)
            : undefined,
      updatedAt: typeof job?.updated_at === 'string' ? job.updated_at : undefined,
      raw: job,
    };
  }

  private buildFallbackRoles(reason: string): AtsRoleSummary[] {
    return [
      {
        id: `demo-greenhouse-1-${reason}`,
        title: 'Hospitalist · Nights',
        location: 'Boston, MA',
        department: 'Hospital Medicine',
        openings: 3,
        updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        raw: { reason },
      },
      {
        id: `demo-greenhouse-2-${reason}`,
        title: 'Advanced Practice Provider · Telehealth',
        location: 'Remote',
        department: 'Virtual Care',
        openings: 5,
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
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
      throw new Error('Greenhouse base URL is not configured');
    }

    const url = new URL(path.replace(/^\//, ''), this.baseUrl).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
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
          `Greenhouse responded with ${response.status}: ${
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

export function createGreenhouseConnector(
  connection: EmployerAtsRecord,
  options?: ConnectorOptions,
): AtsConnector {
  return new GreenhouseConnector(connection, options);
}

