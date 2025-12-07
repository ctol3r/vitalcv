import { Prisma, PrismaClient, NPDBQuery, NPDBQueryStatus } from '@prisma/client';

const prisma = new PrismaClient();

const STATE_REGEX = /^[A-Z]{2}$/;
const NPI_REGEX = /^\d{10}$/;

export interface CreateNPDBQueryInput {
  clinicianId: string;
  npi: string;
  state: string;
  requestXml: string;
  status?: NPDBQueryStatus;
  resultSummary?: Prisma.JsonValue;
}

export interface UpdateNPDBQueryInput {
  status?: NPDBQueryStatus;
  responseXml?: string | null;
  resultSummary?: Prisma.JsonValue | null;
  failureReason?: string | null;
}

export interface ListNPDBQueryFilters {
  clinicianId?: string;
  npi?: string;
  status?: NPDBQueryStatus;
  limit?: number;
}

const STATUS_TRANSITIONS: Record<NPDBQueryStatus, NPDBQueryStatus[]> = {
  [NPDBQueryStatus.PENDING]: [
    NPDBQueryStatus.SENT,
    NPDBQueryStatus.COMPLETED,
    NPDBQueryStatus.FAILED,
  ],
  [NPDBQueryStatus.SENT]: [NPDBQueryStatus.COMPLETED, NPDBQueryStatus.FAILED],
  [NPDBQueryStatus.COMPLETED]: [],
  [NPDBQueryStatus.FAILED]: [],
};

function normalizeClinicianId(clinicianId: string): string {
  const normalized = clinicianId.trim();
  if (!normalized) {
    throw new Error('clinicianId is required');
  }
  return normalized;
}

function normalizeState(state: string): string {
  const normalized = state.trim().toUpperCase();
  if (!STATE_REGEX.test(normalized)) {
    throw new Error(`state must be a 2-letter code (received "${state}")`);
  }
  return normalized;
}

function normalizeNpi(npi: string): string {
  const trimmed = npi.trim();
  if (!NPI_REGEX.test(trimmed)) {
    throw new Error('npi must be a 10-digit numeric string');
  }
  return trimmed;
}

function ensureXml(xml: string, field: 'requestXml' | 'responseXml'): string {
  const trimmed = xml.trim();
  if (!trimmed) {
    throw new Error(`${field} cannot be empty`);
  }
  return trimmed;
}

function assertStatusTransition(
  current: NPDBQueryStatus,
  next: NPDBQueryStatus
): void {
  if (current === next) {
    return;
  }
  const allowed = STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid NPDB query status transition: ${current} → ${next}`);
  }
}

function applyStatusSideEffects(
  nextStatus: NPDBQueryStatus,
  data: Prisma.NPDBQueryUpdateInput
): void {
  if (nextStatus === NPDBQueryStatus.SENT) {
    data.sentAt = new Date();
  }
  if (nextStatus === NPDBQueryStatus.COMPLETED || nextStatus === NPDBQueryStatus.FAILED) {
    data.completedAt = new Date();
  }
}

export async function createNPDBQuery(
  input: CreateNPDBQueryInput
): Promise<NPDBQuery> {
  const status = input.status ?? NPDBQueryStatus.PENDING;

  const record = await prisma.nPDBQuery.create({
    data: {
      clinicianId: normalizeClinicianId(input.clinicianId),
      npi: normalizeNpi(input.npi),
      state: normalizeState(input.state),
      status,
      requestXml: ensureXml(input.requestXml, 'requestXml'),
      resultSummary: input.resultSummary ?? null,
    },
  });

  return record;
}

export async function getNPDBQueryById(id: string): Promise<NPDBQuery | null> {
  return prisma.nPDBQuery.findUnique({ where: { id } });
}

export async function listNPDBQueries(
  filters: ListNPDBQueryFilters = {}
): Promise<NPDBQuery[]> {
  const where: Prisma.NPDBQueryWhereInput = {};

  if (filters.clinicianId) {
    where.clinicianId = normalizeClinicianId(filters.clinicianId);
  }
  if (filters.npi) {
    where.npi = normalizeNpi(filters.npi);
  }
  if (filters.status) {
    where.status = filters.status;
  }

  const take = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  return prisma.nPDBQuery.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function updateNPDBQuery(
  id: string,
  updates: UpdateNPDBQueryInput
): Promise<NPDBQuery> {
  const existing = await prisma.nPDBQuery.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`NPDB query ${id} not found`);
  }

  const data: Prisma.NPDBQueryUpdateInput = {};

  if (updates.status) {
    assertStatusTransition(existing.status, updates.status);
    data.status = updates.status;
    applyStatusSideEffects(updates.status, data);
  }

  if (updates.responseXml !== undefined) {
    data.responseXml = updates.responseXml
      ? ensureXml(updates.responseXml, 'responseXml')
      : null;
  }

  if (updates.resultSummary !== undefined) {
    data.resultSummary = updates.resultSummary ?? null;
  }

  if (updates.failureReason !== undefined) {
    data.failureReason = updates.failureReason ?? null;
  }

  if (Object.keys(data).length === 0) {
    throw new Error('No updates provided for NPDB query');
  }

  return prisma.nPDBQuery.update({
    where: { id },
    data,
  });
}

export async function deleteNPDBQuery(id: string): Promise<NPDBQuery> {
  return prisma.nPDBQuery.delete({ where: { id } });
}

export async function resetNPDBQueryToPending(id: string): Promise<NPDBQuery> {
  const existing = await prisma.nPDBQuery.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`NPDB query ${id} not found`);
  }

  if (existing.status === NPDBQueryStatus.COMPLETED || existing.status === NPDBQueryStatus.FAILED) {
    throw new Error('Completed or failed NPDB queries cannot be reset');
  }

  return prisma.nPDBQuery.update({
    where: { id },
    data: {
      status: NPDBQueryStatus.PENDING,
      responseXml: null,
      resultSummary: null,
      failureReason: null,
      sentAt: null,
      completedAt: null,
    },
  });
}

export async function latestNPDBQueryForClinician(
  clinicianId: string
): Promise<NPDBQuery | null> {
  return prisma.nPDBQuery.findFirst({
    where: { clinicianId: normalizeClinicianId(clinicianId) },
    orderBy: { createdAt: 'desc' },
  });
}

export type NPDBQueryRecord = NPDBQuery;

