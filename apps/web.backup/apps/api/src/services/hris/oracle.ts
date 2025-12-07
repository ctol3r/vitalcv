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

export interface OracleProvisioningRequest {
  clinicianId: string;
  orgId?: string;
  roles?: string[];
  location?: string;
}

export class OracleIdentityProvisioner {
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

  async provision(request: OracleProvisioningRequest) {
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

    const payload = buildScimPayload({
      clinicianId: profile.id,
      name: profile.user?.name ?? profile.id,
      email: profile.user?.email ?? `${profile.id}@example.invalid`,
      orgId: request.orgId ?? profile.orgId ?? this.connection.orgId,
      specialty: profile.specialty ?? undefined,
      location: request.location ?? profile.location ?? undefined,
      roles: request.roles ?? ['clinician'],
    });

    const attempt = await executeWithRegionFallback(this.endpoints, async (endpoint) =>
      this.request('POST', endpoint, 'scim/v2/Users', payload),
    );

    recordHrisSyncLog({
      orgId: this.connection.orgId,
      vendor: normalizeVendorType(this.connection.type),
      action: 'oracle.provisionIdentity',
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

    return attempt.result;
  }

  async testConnection(): Promise<HrisConnectorTestResult> {
    const startedAt = new Date();
    const steps: HrisConnectorTestStep[] = [];
    try {
      const attempt = await executeWithRegionFallback(this.endpoints, async (endpoint) =>
        this.measureStep('SCIM ping', steps, () => this.request('GET', endpoint, 'scim/v2/ServiceProviderConfig')),
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
        message: 'Oracle SCIM endpoint reachable',
        steps,
      };
    } catch (error) {
      const completedAt = new Date();
      steps.push({
        name: 'SCIM ping',
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
      throw new Error('oracle_endpoint_missing');
    }
    const url = new URL(path.replace(/^\//, ''), endpoint.endpoint).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/scim+json',
          Authorization: `Bearer ${this.connection.secret}`,
          'Content-Type': 'application/json',
          'User-Agent': 'VitalCV-HRIS-Oracle/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = text ? parseJson(text) : null;
      if (!response.ok) {
        throw new Error(
          `oracle_${response.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {})}`,
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

function buildScimPayload(input: {
  clinicianId: string;
  name: string;
  email: string;
  orgId: string;
  specialty?: string;
  location?: string;
  roles: string[];
}) {
  const [givenName, ...rest] = input.name.split(' ');
  const familyName = rest.join(' ') || givenName;

  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User', 'urn:scim:schemas:extension:enterprise:2.0:User'],
    userName: `${input.clinicianId}@${input.orgId}`,
    name: {
      givenName,
      familyName,
      formatted: input.name,
    },
    emails: [
      {
        value: input.email,
        primary: true,
        type: 'work',
      },
    ],
    urn: {
      'scim:schemas:extension:enterprise:2.0:User': {
        department: input.specialty ?? 'Clinical',
        organization: input.orgId,
        costCenter: 'VitalCV-HRIS',
        manager: {
          displayName: 'Credentialing Automation',
        },
      },
    },
    roles: input.roles.map((role) => ({ value: role })),
    groups: (input.specialty ? [input.specialty] : []).map((value) => ({ value })),
    addresses: input.location
      ? [
          {
            type: 'work',
            formatted: input.location,
          },
        ]
      : [],
    active: true,
    externalId: input.clinicianId,
  };
}

function parseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}


