import { prisma } from '@/lib/prisma';

export interface SanctionEvent {
  source: 'npdb' | 'oig_leie' | 'state_board';
  eventId: string;
  eventDate: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: Record<string, unknown>;
}

export interface SanctionsIngestionResult {
  clinicianId: string;
  events: SanctionEvent[];
  ingestedAt: string;
}

/**
 * Ingest sanctions from NPDB, OIG LEIE, and state board actions
 */
export async function ingestSanctionsV2(
  clinicianId: string,
): Promise<SanctionsIngestionResult> {
  const events: SanctionEvent[] = [];

  // Ingest from NPDB (mock - would integrate with actual NPDB API)
  const npdbEvents = await ingestNPDBSanctions(clinicianId);
  events.push(...npdbEvents);

  // Ingest from OIG LEIE (mock - would integrate with actual OIG API)
  const oigEvents = await ingestOIGLEIE(clinicianId);
  events.push(...oigEvents);

  // Ingest from state board actions
  const stateBoardEvents = await ingestStateBoardActions(clinicianId);
  events.push(...stateBoardEvents);

  // Upsert safety exchange
  await prisma.safetyExchange.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      events: { events, ingestedAt: new Date().toISOString() },
    },
    update: {
      events: { events, ingestedAt: new Date().toISOString() },
      updatedAt: new Date(),
    },
  });

  return {
    clinicianId,
    events,
    ingestedAt: new Date().toISOString(),
  };
}

async function ingestNPDBSanctions(clinicianId: string): Promise<SanctionEvent[]> {
  // Mock implementation - would call NPDB API
  // In production, this would query NPDB database
  return [];
}

async function ingestOIGLEIE(clinicianId: string): Promise<SanctionEvent[]> {
  // Mock implementation - would call OIG LEIE API
  // In production, this would query OIG Exclusion List
  return [];
}

async function ingestStateBoardActions(clinicianId: string): Promise<SanctionEvent[]> {
  // Query existing safety signals and risk events
  const safetySignals = await prisma.safetySignal.findMany({
    where: { clinicianId },
    orderBy: { reportedAt: 'desc' },
  });

  return safetySignals
    .filter((signal) => signal.severity === 'high' || signal.type === 'adverse-event')
    .map((signal) => ({
      source: 'state_board' as const,
      eventId: signal.id,
      eventDate: signal.reportedAt.toISOString(),
      type: signal.type,
      severity: mapSeverity(signal.severity),
      description: `Safety signal: ${signal.type}`,
      metadata: signal.metadata as Record<string, unknown>,
    }));
}

function mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'moderate':
      return 'medium';
    default:
      return 'low';
  }
}

