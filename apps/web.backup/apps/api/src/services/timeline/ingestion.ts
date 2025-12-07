import { prisma } from '@/lib/prisma';
import type { ExperienceTimeline } from '@prisma/client';

export interface TimelineEvent {
  type: 'job' | 'privilege' | 'board_cert' | 'cme' | 'safety_event';
  startDate: string;
  endDate?: string;
  title: string;
  organization?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineIngestionResult {
  timelineId: string;
  eventCount: number;
  events: TimelineEvent[];
}

/**
 * Extract timeline events from various sources
 */
export async function ingestTimelineEvents(
  clinicianId: string,
): Promise<TimelineIngestionResult> {
  const events: TimelineEvent[] = [];

  // Extract jobs (from hiring events, onboarding, etc.)
  const jobs = await extractJobs(clinicianId);
  events.push(...jobs);

  // Extract privileges (from privilege assignments)
  const privileges = await extractPrivileges(clinicianId);
  events.push(...privileges);

  // Extract board certifications
  const boardCerts = await extractBoardCertifications(clinicianId);
  events.push(...boardCerts);

  // Extract CME activities
  const cmeActivities = await extractCME(clinicianId);
  events.push(...cmeActivities);

  // Extract safety events
  const safetyEvents = await extractSafetyEvents(clinicianId);
  events.push(...safetyEvents);

  // Upsert timeline
  const timeline = await prisma.experienceTimeline.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      timeline: { events, ingestedAt: new Date().toISOString() },
    },
    update: {
      timeline: { events, ingestedAt: new Date().toISOString() },
      updatedAt: new Date(),
    },
  });

  return {
    timelineId: timeline.id,
    eventCount: events.length,
    events,
  };
}

async function extractJobs(clinicianId: string): Promise<TimelineEvent[]> {
  // Query hiring events, onboarding checkpoints, etc.
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'asc' },
  });

  return hiringEvents
    .filter((event) => ['onboarded', 'privileged'].includes(event.eventType))
    .map((event) => ({
      type: 'job' as const,
      startDate: event.createdAt.toISOString(),
      title: `Employment at ${event.metadata?.orgName ?? 'Organization'}`,
      organization: event.metadata?.orgName as string | undefined,
      metadata: {
        eventId: event.id,
        eventType: event.eventType,
        employerId: event.employerId,
      },
    }));
}

async function extractPrivileges(clinicianId: string): Promise<TimelineEvent[]> {
  // Query privilege assignments (would need PrivilegeAssignment model or similar)
  // For now, return empty array - this would be implemented based on actual privilege data structure
  return [];
}

async function extractBoardCertifications(clinicianId: string): Promise<TimelineEvent[]> {
  // Query board certifications (would need BoardCert model or similar)
  // For now, return empty array
  return [];
}

async function extractCME(clinicianId: string): Promise<TimelineEvent[]> {
  // Query CME activities (would need CMERecord model or similar)
  // For now, return empty array
  return [];
}

async function extractSafetyEvents(clinicianId: string): Promise<TimelineEvent[]> {
  const safetySignals = await prisma.safetySignal.findMany({
    where: { clinicianId },
    orderBy: { reportedAt: 'asc' },
  });

  return safetySignals.map((signal) => ({
    type: 'safety_event' as const,
    startDate: signal.reportedAt.toISOString(),
    title: `${signal.type} - ${signal.severity}`,
    metadata: {
      signalId: signal.id,
      type: signal.type,
      severity: signal.severity,
      metadata: signal.metadata,
    },
  }));
}

