import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TrustEvent {
  type: 'issuer_trust_change' | 'employer_eval' | 'safety_event' | 'chain_issue';
  clinicianId: string;
  timestamp: Date;
  data: Record<string, unknown>;
  source?: string;
}

/**
 * Ingest trust events from various sources
 */
export async function ingestTrustEvent(event: TrustEvent): Promise<void> {
  // Get or create trajectory
  let trajectory = await prisma.providerTrustTrajectory.findUnique({
    where: { clinicianId: event.clinicianId },
  });

  const trajectoryData = trajectory
    ? (trajectory.trajectory as Array<TrustEvent & { id: string }>)
    : [];

  // Add new event
  const newEvent = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...event,
  };

  trajectoryData.push(newEvent);

  // Update or create trajectory
  if (trajectory) {
    await prisma.providerTrustTrajectory.update({
      where: { id: trajectory.id },
      data: {
        trajectory: trajectoryData,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.providerTrustTrajectory.create({
      data: {
        clinicianId: event.clinicianId,
        trajectory: trajectoryData,
      },
    });
  }
}

/**
 * Ingest issuer trust changes
 */
export async function ingestIssuerTrustChange(
  clinicianId: string,
  issuerId: string,
  change: 'increased' | 'decreased' | 'maintained',
  reason: string,
): Promise<void> {
  await ingestTrustEvent({
    type: 'issuer_trust_change',
    clinicianId,
    timestamp: new Date(),
    data: {
      issuerId,
      change,
      reason,
    },
    source: 'issuer',
  });
}

/**
 * Ingest employer evaluations
 */
export async function ingestEmployerEval(
  clinicianId: string,
  employerId: string,
  score: number,
  feedback?: string,
): Promise<void> {
  await ingestTrustEvent({
    type: 'employer_eval',
    clinicianId,
    timestamp: new Date(),
    data: {
      employerId,
      score,
      feedback,
    },
    source: 'employer',
  });
}

/**
 * Ingest safety events
 */
export async function ingestSafetyEvent(
  clinicianId: string,
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, unknown>,
): Promise<void> {
  await ingestTrustEvent({
    type: 'safety_event',
    clinicianId,
    timestamp: new Date(),
    data: {
      eventType,
      severity,
      details,
    },
    source: 'safety_monitoring',
  });
}

/**
 * Ingest chain issues
 */
export async function ingestChainIssue(
  clinicianId: string,
  issueType: string,
  description: string,
  resolved: boolean,
): Promise<void> {
  await ingestTrustEvent({
    type: 'chain_issue',
    clinicianId,
    timestamp: new Date(),
    data: {
      issueType,
      description,
      resolved,
    },
    source: 'chain_monitor',
  });
}

