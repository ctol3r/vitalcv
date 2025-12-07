import { PrismaClient } from '@prisma/client';
import { CredentialRiskFactors } from '../enums';

const prisma = new PrismaClient();

export type CredentialRiskDetails = Partial<Record<CredentialRiskFactors, string>>;

export interface CredentialRiskRecord {
  clinicianId: string;
  score: number;
  factors: CredentialRiskFactors[];
  details: CredentialRiskDetails;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertCredentialRiskInput {
  clinicianId: string;
  score: number;
  factors: CredentialRiskFactors[];
  details?: CredentialRiskDetails;
}

function clampScore(score: number): number {
  if (Number.isNaN(score) || !Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeFactors(factors: CredentialRiskFactors[]): CredentialRiskFactors[] {
  return Array.from(new Set(factors));
}

function serializeDetails(details?: CredentialRiskDetails | null): CredentialRiskDetails {
  if (!details) return {};
  return Object.fromEntries(
    Object.entries(details).filter(
      ([, value]) => typeof value === 'string' && value.trim().length > 0
    )
  ) as CredentialRiskDetails;
}

function deserializeRecord(record: any): CredentialRiskRecord {
  return {
    clinicianId: record.clinicianId,
    score: record.score,
    factors: (record.factors as CredentialRiskFactors[]) ?? [],
    details: serializeDetails(record.details as CredentialRiskDetails | null),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export async function upsertCredentialRisk(
  input: UpsertCredentialRiskInput,
  client: PrismaClient = prisma
): Promise<CredentialRiskRecord> {
  const score = clampScore(input.score);
  const factors = normalizeFactors(input.factors);
  const details = serializeDetails(input.details);

  const record = await client.credentialRisk.upsert({
    where: { clinicianId: input.clinicianId },
    create: {
      clinicianId: input.clinicianId,
      score,
      factors,
      details,
    },
    update: {
      score,
      factors,
      details,
      updatedAt: new Date(),
    },
  });

  return deserializeRecord(record);
}

export async function getCredentialRisk(
  clinicianId: string,
  client: PrismaClient = prisma
): Promise<CredentialRiskRecord | null> {
  if (!clinicianId) return null;

  const record = await client.credentialRisk.findUnique({
    where: { clinicianId },
  });

  return record ? deserializeRecord(record) : null;
}

export async function listCredentialRisks(
  limit = 50,
  client: PrismaClient = prisma
): Promise<CredentialRiskRecord[]> {
  const records = await client.credentialRisk.findMany({
    orderBy: { updatedAt: 'desc' },
    take: Math.min(limit, 500),
  });

  return records.map(deserializeRecord);
}

export interface CredentialRiskSummary {
  clinicianId: string;
  score: number;
  factors: CredentialRiskFactors[];
  updatedAt: string;
  details: CredentialRiskDetails;
}

export async function getCredentialRiskSummary(
  clinicianId: string,
  client: PrismaClient = prisma
): Promise<CredentialRiskSummary | null> {
  const record = await getCredentialRisk(clinicianId, client);
  if (!record) return null;

  return {
    clinicianId: record.clinicianId,
    score: record.score,
    factors: record.factors,
    updatedAt: record.updatedAt.toISOString(),
    details: record.details,
  };
}

