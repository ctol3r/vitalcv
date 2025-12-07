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
} from './types';
import { buildUnconfiguredResponse, ensureRequestId, normalizeBaseUrl } from './types';

const log = getServiceLogger('api/services/ats/lever');
const DEFAULT_BASE_URL = 'https://api.lever.co/v1/';
const DEFAULT_TIMEOUT = 20_000;

export class LeverConnector implements AtsConnector {
  readonly name = 'lever';

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(connection: EmployerAtsRecord, options: ConnectorOptions = {}) {
    this.baseUrl = normalizeBaseUrl(connection.apiUrl, DEFAULT_BASE_URL);
    this.apiKey = connection.apiKey ?? process.env.LEVER_API_KEY ?? undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  async pushCandidate(payload: AtsCandidateDelivery): Promise<AtsConnectorResponse> {
    if (!this.apiKey) {
      return buildUnconfiguredResponse(this.name, 'API key missing');
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
        message: 'Candidate posted to Lever pipeline',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('Lever delivery failed', {
        clinicianId: payload.clinicianId,
        error: message,
      });
      return {
        delivered: false,
        statusCode: 0,
        requestId,
        error: message,
        message: 'Lever delivery failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async fetchOpenRoles(options?: { limit?: number }): Promise<AtsRoleSummary[]> {
    if (!this.apiKey) {
      return this.buildFallbackRoles('missing_api_key');
    }

    const limit = Math.max(1, Math.min(options?.limit ?? 15, 100));
    try {
      const response = await this.request<{ data?: Record<string, unknown>[] }>(
        'GET',
        `postings?state=published&limit=${limit}`,
      );
      const postings = Array.isArray(response.body?.data) ? response.body?.data : [];
      return postings.map((posting) => this.mapPosting(posting));
    } catch (error) {
      log.warn('Lever postings fetch failed', {
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
        message: 'API key missing',
      };
    }
    const start = Date.now();
    try {
      await this.request('GET', 'postings?limit=1');
      return {
        ok: true,
        lastChecked,
        latencyMs: Date.now() - start,
        message: 'Lever API reachable',
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
    const tags = new Set<string>(['Vital Credentialing']);

    if (payload.screening) {
      tags.add(`screening:${payload.screening.verdict}`);
    }
    if (profile.specialty) {
      tags.add(`specialty:${profile.specialty}`);
    }

    return {
      name: profile.fullName ?? payload.clinicianId,
      emails: profile.email ? [profile.email] : [],
      phones: profile.phone ? [profile.phone] : [],
      links:
        payload.metadata && typeof payload.metadata['profileUrl'] === 'string'
          ? [{ text: 'Vital CV', url: payload.metadata['profileUrl'] as string }]
          : [],
      headline: profile.specialty ?? 'Clinician',
      summary: this.buildSummary(payload),
      fields: {
        readinessScore: readiness,
        readinessLabel: payload.readinessLabel ?? null,
        compactEligible:
          payload.screening?.components?.find((c) => c.key === 'compact')?.detail ?? null,
      },
      tags: Array.from(tags),
      origins: [
        {
          type: 'applied',
          value: payload.orgId ?? 'vitalcv',
        },
      ],
      resume: payload.bundle
        ? Buffer.from(JSON.stringify(payload.bundle)).toString('base64')
        : undefined,
    };
  }

  private buildSummary(payload: AtsCandidateDelivery): string {
    const profile = payload.profile ?? {};
    const parts = [
      `Candidate: ${profile.fullName ?? payload.clinicianId}`,
      profile.location ? `Location: ${profile.location}` : null,
      profile.specialty ? `Specialty: ${profile.specialty}` : null,
      payload.readinessScore !== undefined && payload.readinessScore !== null
        ? `Readiness: ${(payload.readinessScore * 100).toFixed(1)} pts`
        : null,
      payload.screening
        ? `Screening verdict: ${payload.screening.verdict}`
        : null,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  private mapPosting(posting: Record<string, unknown>): AtsRoleSummary {
    const categories =
      typeof posting?.categories === 'object' && posting.categories
        ? (posting.categories as Record<string, unknown>)
        : {};
    const distribution = Array.isArray(posting?.distributionChannels)
      ? (posting?.distributionChannels as unknown[])
      : [];

    return {
      id: String(posting?.id ?? randomUUID()),
      title: typeof posting?.text === 'string' ? posting.text : 'Open role',
      location:
        typeof categories?.location === 'string'
          ? (categories.location as string)
          : undefined,
      department:
        typeof categories?.department === 'string'
          ? (categories.department as string)
          : undefined,
      openings: distribution.length || undefined,
      updatedAt:
        typeof posting?.updatedAt === 'number'
          ? new Date(posting.updatedAt as number).toISOString()
          : typeof posting?.updatedAt === 'string'
            ? (posting.updatedAt as string)
            : undefined,
      raw: posting,
    };
  }

  private buildFallbackRoles(reason: string): AtsRoleSummary[] {
    return [
      {
        id: `demo-lever-1-${reason}`,
        title: 'Nurse Practitioner · Oncology',
        location: 'San Diego, CA',
        department: 'Oncology',
        openings: 2,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        raw: { reason },
      },
      {
        id: `demo-lever-2-${reason}`,
        title: 'Clinical Pharmacist · Behavioral Health',
        location: 'Remote',
        department: 'Pharmacy',
        openings: 1,
        updatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
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
      throw new Error('Lever base URL is not configured');
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
          `Lever responded with ${response.status}: ${
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

export function createLeverConnector(
  connection: EmployerAtsRecord,
  options?: ConnectorOptions,
): AtsConnector {
  return new LeverConnector(connection, options);
}

