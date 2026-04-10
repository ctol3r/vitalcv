import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';

const DEAL_AUDIT_TYPE = 'REVENUE_DEAL_TRACKED';
const VALIDATION_AUDIT_TYPE = 'REVENUE_VALIDATION_EVENT';
const KPI_AUDIT_TYPE = 'REVENUE_KPI_SNAPSHOT';

export type Deal = {
  orgName: string;
  contact: string;
  status: string;
  lastContacted: string;
  nextStep: string;
  value: number;
  notes: string;
};

export type ValidationEventName =
  | 'bundle_generated'
  | 'bundle_shared'
  | 'employer_viewed'
  | 'employer_feedback'
  | 'time_saved_confirmed';

export type RevenueValidationKpi = {
  time_saved_days: number;
  conversion_rate: number;
  pilot_interest_rate: number;
};

export type StoredDeal = Deal & {
  id: string;
  createdAt: string;
};

export type RevenueValidationEvent = {
  id: string;
  eventName: ValidationEventName;
  bundleId: string | null;
  npi: string | null;
  organizationId: string | null;
  orgName: string | null;
  contact: string | null;
  notes: string | null;
  value: number | null;
  time_saved_days: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type StoredRevenueValidationKpi = RevenueValidationKpi & {
  id: string;
  notes: string | null;
  createdAt: string;
};

export type RevenueValidationEventInput = {
  eventName: ValidationEventName;
  bundleId?: string;
  npi?: string;
  organizationId?: string;
  orgName?: string;
  contact?: string;
  notes?: string;
  value?: number;
  time_saved_days?: number;
  metadata?: Record<string, unknown>;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function trimOrEmpty(value: string): string {
  return value.trim();
}

function normalizeDeal(input: Deal): Deal {
  return {
    orgName: trimOrEmpty(input.orgName),
    contact: trimOrEmpty(input.contact),
    status: trimOrEmpty(input.status),
    lastContacted: trimOrEmpty(input.lastContacted),
    nextStep: trimOrEmpty(input.nextStep),
    value: input.value,
    notes: trimOrEmpty(input.notes),
  };
}

function normalizeKpis(input: RevenueValidationKpi): RevenueValidationKpi {
  return {
    time_saved_days: input.time_saved_days,
    conversion_rate: input.conversion_rate,
    pilot_interest_rate: input.pilot_interest_rate,
  };
}

async function createAuditEvent(input: {
  id: string;
  type: string;
  referenceId: string;
  clinicianId?: string | null;
  organizationId?: string | null;
  metadata: Record<string, unknown>;
}): Promise<Date> {
  const hash = sha256ForPayload({
    type: input.type,
    referenceId: input.referenceId,
    clinicianId: input.clinicianId ?? null,
    organizationId: input.organizationId ?? null,
    metadata: input.metadata,
  });

  const row = await prisma.auditEvent.create({
    data: {
      id: input.id,
      type: input.type,
      hash,
      referenceId: input.referenceId,
      clinicianId: input.clinicianId ?? null,
      organizationId: input.organizationId ?? null,
      metadata: JSON.parse(JSON.stringify(input.metadata)),
    },
    select: { createdAt: true },
  });

  return row.createdAt;
}

export async function trackDeal(input: Deal): Promise<StoredDeal> {
  const id = randomUUID();
  const deal = normalizeDeal(input);
  const createdAt = await createAuditEvent({
    id,
    type: DEAL_AUDIT_TYPE,
    referenceId: id,
    metadata: { deal },
  });

  log('info', 'revenue_validation.deal_tracked', {
    id,
    orgName: deal.orgName,
    status: deal.status,
    value: deal.value,
  });

  return {
    id,
    createdAt: createdAt.toISOString(),
    ...deal,
  };
}

export async function listDeals(limit: number = 50): Promise<StoredDeal[]> {
  const rows = await prisma.auditEvent.findMany({
    where: { type: DEAL_AUDIT_TYPE },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return rows.flatMap((row) => {
    const metadata = readRecord(row.metadata);
    const deal = readRecord(metadata.deal);
    const value = readNumber(deal.value);
    if (value === null) return [];

    return [{
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      orgName: readString(deal.orgName) ?? '',
      contact: readString(deal.contact) ?? '',
      status: readString(deal.status) ?? '',
      lastContacted: readString(deal.lastContacted) ?? '',
      nextStep: readString(deal.nextStep) ?? '',
      value,
      notes: readString(deal.notes) ?? '',
    }];
  });
}

export async function recordValidationEvent(
  input: RevenueValidationEventInput,
): Promise<RevenueValidationEvent> {
  const id = randomUUID();
  const metadata = {
    validationEvent: {
      eventName: input.eventName,
      bundleId: input.bundleId ?? null,
      npi: input.npi ?? null,
      organizationId: input.organizationId ?? null,
      orgName: input.orgName ?? null,
      contact: input.contact ?? null,
      notes: input.notes ?? null,
      value: input.value ?? null,
      time_saved_days: input.time_saved_days ?? null,
      metadata: input.metadata ?? {},
    },
  };

  const createdAt = await createAuditEvent({
    id,
    type: VALIDATION_AUDIT_TYPE,
    referenceId: input.bundleId ?? id,
    clinicianId: input.npi ?? null,
    organizationId: input.organizationId ?? null,
    metadata,
  });

  log('info', 'revenue_validation.event_recorded', {
    id,
    eventName: input.eventName,
    bundleId: input.bundleId ?? null,
    organizationId: input.organizationId ?? null,
  });

  return {
    id,
    eventName: input.eventName,
    bundleId: input.bundleId ?? null,
    npi: input.npi ?? null,
    organizationId: input.organizationId ?? null,
    orgName: input.orgName ?? null,
    contact: input.contact ?? null,
    notes: input.notes ?? null,
    value: input.value ?? null,
    time_saved_days: input.time_saved_days ?? null,
    metadata: input.metadata ?? {},
    createdAt: createdAt.toISOString(),
  };
}

export async function listValidationEvents(input?: {
  eventName?: ValidationEventName;
  limit?: number;
}): Promise<RevenueValidationEvent[]> {
  const rows = await prisma.auditEvent.findMany({
    where: { type: VALIDATION_AUDIT_TYPE },
    orderBy: { createdAt: 'desc' },
    take: input?.limit ?? 50,
  });

  return rows.flatMap((row) => {
    const metadata = readRecord(row.metadata);
    const validationEvent = readRecord(metadata.validationEvent);
    const rawEventName = readString(validationEvent.eventName);
    if (!rawEventName) return [];
    if (input?.eventName && rawEventName !== input.eventName) return [];

    return [{
      id: row.id,
      eventName: rawEventName as ValidationEventName,
      bundleId: readString(validationEvent.bundleId),
      npi: readString(validationEvent.npi),
      organizationId: readString(validationEvent.organizationId),
      orgName: readString(validationEvent.orgName),
      contact: readString(validationEvent.contact),
      notes: readString(validationEvent.notes),
      value: readNumber(validationEvent.value),
      time_saved_days: readNumber(validationEvent.time_saved_days),
      metadata: readRecord(validationEvent.metadata),
      createdAt: row.createdAt.toISOString(),
    }];
  });
}

export async function storeRevenueValidationKpis(
  input: RevenueValidationKpi & { notes?: string },
): Promise<StoredRevenueValidationKpi> {
  const id = randomUUID();
  const kpis = normalizeKpis(input);
  const notes = input.notes?.trim() ?? null;

  const createdAt = await createAuditEvent({
    id,
    type: KPI_AUDIT_TYPE,
    referenceId: id,
    metadata: {
      kpis,
      notes,
    },
  });

  log('info', 'revenue_validation.kpis_stored', {
    id,
    ...kpis,
  });

  return {
    id,
    createdAt: createdAt.toISOString(),
    notes,
    ...kpis,
  };
}

export async function getLatestRevenueValidationKpis(): Promise<StoredRevenueValidationKpi | null> {
  const row = await prisma.auditEvent.findFirst({
    where: { type: KPI_AUDIT_TYPE },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) return null;

  const metadata = readRecord(row.metadata);
  const kpis = readRecord(metadata.kpis);
  const time_saved_days = readNumber(kpis.time_saved_days);
  const conversion_rate = readNumber(kpis.conversion_rate);
  const pilot_interest_rate = readNumber(kpis.pilot_interest_rate);

  if (time_saved_days === null || conversion_rate === null || pilot_interest_rate === null) {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    notes: readString(metadata.notes),
    time_saved_days,
    conversion_rate,
    pilot_interest_rate,
  };
}
