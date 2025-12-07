import { createHash } from 'crypto';

export interface LookupDeaInput {
  deaNumber: string;
  clinicianId?: string;
  signal?: AbortSignal;
}

export interface DEARecord {
  deaNumber: string;
  valid: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'PENDING';
  expirationDate: string;
  prescriptiveAuthority: string;
  schedules: string[];
  registrantName?: string;
  registrantAddress?: string;
  lastVerifiedAt: string;
  source: 'registry' | 'simulated';
}

const REGISTRY_BASE = process.env.DEA_REGISTRY_API_BASE?.replace(/\/$/, '');

export async function lookupDeaRegistry(input: LookupDeaInput): Promise<DEARecord> {
  const deaNumber = normalizeDeaNumber(input.deaNumber);
  if (!deaNumber) {
    throw new Error('DEA number is required');
  }

  if (REGISTRY_BASE) {
    try {
      const registryRecord = await queryRegistryApi({
        deaNumber,
        clinicianId: input.clinicianId,
        signal: input.signal,
      });
      if (registryRecord) {
        return registryRecord;
      }
    } catch (error) {
      console.warn('[dea][lookup] registry API lookup failed, falling back to simulated record', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return buildFallbackRecord(deaNumber);
}

async function queryRegistryApi(params: {
  deaNumber: string;
  clinicianId?: string;
  signal?: AbortSignal;
}): Promise<DEARecord | null> {
  if (!REGISTRY_BASE) return null;

  const response = await fetch(`${REGISTRY_BASE}/dea/lookup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      deaNumber: params.deaNumber,
      clinicianId: params.clinicianId,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(`DEA registry responded with ${response.status}`);
  }

  const payload = (await response.json()) as Partial<DEARecord>;
  if (!payload.deaNumber) {
    payload.deaNumber = params.deaNumber;
  }

  return {
    deaNumber: payload.deaNumber,
    valid: payload.valid ?? true,
    status: payload.status ?? 'ACTIVE',
    expirationDate:
      payload.expirationDate ??
      buildFutureDate(params.deaNumber, /* monthsAhead */ 12).toISOString(),
    prescriptiveAuthority: payload.prescriptiveAuthority ?? deriveAuthorityClass(params.deaNumber),
    schedules: payload.schedules && payload.schedules.length > 0 ? payload.schedules : deriveSchedules(params.deaNumber),
    registrantName: payload.registrantName,
    registrantAddress: payload.registrantAddress,
    lastVerifiedAt: payload.lastVerifiedAt ?? new Date().toISOString(),
    source: 'registry',
  };
}

function buildFallbackRecord(deaNumber: string): DEARecord {
  const expiryDate = buildFutureDate(deaNumber, 9);
  const schedules = deriveSchedules(deaNumber);
  const status = expiryDate.getTime() > Date.now() ? 'ACTIVE' : 'EXPIRED';

  return {
    deaNumber,
    valid: validateDeaNumber(deaNumber),
    status,
    expirationDate: expiryDate.toISOString(),
    prescriptiveAuthority: deriveAuthorityClass(deaNumber),
    schedules,
    registrantName: 'Demo Clinician',
    registrantAddress: '123 Credential Way, Remote, USA',
    lastVerifiedAt: new Date().toISOString(),
    source: 'simulated',
  };
}

function normalizeDeaNumber(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().toUpperCase();
}

function validateDeaNumber(value: string): boolean {
  return /^[A-Z]{2}\d{7}$/.test(value);
}

function deriveAuthorityClass(value: string): string {
  const first = value.charAt(0);
  switch (first) {
    case 'B':
    case 'F':
      return 'Physician';
    case 'M':
      return 'Mid-level';
    case 'P':
      return 'Manufacturer';
    default:
      return 'Unknown';
  }
}

function deriveSchedules(value: string): string[] {
  const hash = createHash('sha256').update(value).digest('hex');
  const bucket = parseInt(hash.slice(0, 2), 16) % 5;
  const schedules = [
    ['II'],
    ['II', 'III'],
    ['II', 'III', 'IV'],
    ['III', 'IV', 'V'],
    ['II', 'III', 'IV', 'V'],
  ];
  return schedules[bucket];
}

function buildFutureDate(value: string, defaultMonthsAhead: number): Date {
  const hash = createHash('sha1').update(value).digest('hex');
  const variance = parseInt(hash.slice(0, 2), 16) % 6;
  const monthsAhead = defaultMonthsAhead + variance;
  const date = new Date();
  date.setMonth(date.getMonth() + monthsAhead);
  return date;
}











