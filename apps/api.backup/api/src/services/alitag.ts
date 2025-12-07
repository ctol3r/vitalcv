import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ALITA-G Compliance Harvesting
 * Emit success events that the ALITA-G librarian can harvest as MCPs
 */

export interface ComplianceEvent {
  domain: string;
  signal: string;
  npi?: string;
  data: Record<string, any>;
}

export async function harvestComplianceSuccess(event: ComplianceEvent) {
  await prisma.agentLog.create({
    data: {
      domain: event.domain,
      signal: event.signal,
      payload: {
        npi: event.npi,
        ...event.data,
        timestamp: new Date().toISOString(),
        tags: ['domain:compliance', `signal:${event.signal}`],
      },
    },
  });
}

// Specific harvesters for common compliance events
export async function harvestPECOSSuccess(npi: string, cycle: string) {
  await harvestComplianceSuccess({
    domain: 'compliance',
    signal: 'pecos_revalidation_success',
    npi,
    data: { cycle, status: 'completed' },
  });
}

export async function harvestTelehealthAuthPass(
  npi: string,
  patientState: string,
  profession: string
) {
  await harvestComplianceSuccess({
    domain: 'compliance',
    signal: 'telehealth_authz_pass',
    npi,
    data: { patientState, profession },
  });
}

export async function harvestPSYPACTSuccess(npi: string, mode: string) {
  await harvestComplianceSuccess({
    domain: 'compliance',
    signal: 'psypact_check_ok',
    npi,
    data: { mode, status: 'valid' },
  });
}

export async function harvestNLC60DaySatisfied(
  npi: string,
  fromState: string,
  toState: string
) {
  await harvestComplianceSuccess({
    domain: 'compliance',
    signal: 'nlc_60day_satisfied',
    npi,
    data: { fromState, toState, status: 'satisfied' },
  });
}

// Search harvested MCPs
export async function searchComplianceMCPs(query: {
  domain?: string;
  signal?: string;
  npi?: string;
  limit?: number;
}) {
  const where: any = {};
  if (query.domain) where.domain = query.domain;
  if (query.signal) where.signal = query.signal;
  if (query.npi) where.payload = { path: ['npi'], equals: query.npi };

  const logs = await prisma.agentLog.findMany({
    where,
    take: query.limit || 50,
    orderBy: { createdAt: 'desc' },
  });

  return logs;
}

