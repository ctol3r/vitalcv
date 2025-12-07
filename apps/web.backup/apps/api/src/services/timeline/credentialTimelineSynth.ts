import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface TimelineEvent {
  id: string;
  type: 'license' | 'cme' | 'board' | 'sanctions' | 'employment' | 'compact';
  timestamp: string;
  source: string;
  data: Record<string, unknown>;
  verified: boolean;
  chainHash?: string;
}

export interface TimelineData {
  events: TimelineEvent[];
  gaps: Array<{ start: string; end: string; type: string }>;
  duplicates: Array<{ eventIds: string[]; type: string }>;
  integrity: {
    score: number;
    issues: string[];
  };
}

/**
 * Task 341.2 — Timeline unification engine v4
 * Combine license, CME, board cert, sanctions, employment.
 */
export async function unifyTimeline(clinicianId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  // Get licenses
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });

  for (const license of licenses) {
    events.push({
      id: `license-${license.id}`,
      type: 'license',
      timestamp: license.createdAt.toISOString(),
      source: license.authority,
      data: {
        licenseNumber: license.licenseNumber,
        status: license.status,
        expiresAt: license.expiresAt,
      },
      verified: license.status === 'active',
      chainHash: license.anchorTxHash || undefined,
    });
  }

  // Get board certifications (from credential lifecycle)
  const boardCerts = await prisma.credentialLifecycle.findMany({
    where: {
      credentialId: { contains: 'board' },
    },
  });

  for (const cert of boardCerts) {
    events.push({
      id: `board-${cert.id}`,
      type: 'board',
      timestamp: cert.timestamp.toISOString(),
      source: 'board',
      data: {
        phase: cert.phase,
        metadata: cert.metadata,
      },
      verified: cert.phase === 'active',
    });
  }

  // Get sanctions
  const sanctions = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      type: 'sanctions',
    },
  });

  for (const sanction of sanctions) {
    events.push({
      id: `sanction-${sanction.id}`,
      type: 'sanctions',
      timestamp: sanction.createdAt.toISOString(),
      source: 'npdb',
      data: {
        type: sanction.type,
        severity: sanction.severity,
        metadata: sanction.metadata,
      },
      verified: true,
    });
  }

  // Get employment events
  const employment = await prisma.hiringEvent.findMany({
    where: { clinicianId },
  });

  for (const emp of employment) {
    events.push({
      id: `employment-${emp.id}`,
      type: 'employment',
      timestamp: emp.createdAt.toISOString(),
      source: emp.employerId,
      data: {
        eventType: emp.eventType,
        employerId: emp.employerId,
        metadata: emp.metadata,
      },
      verified: emp.anchoredAt !== null,
      chainHash: emp.txHash || undefined,
    });
  }

  // Get compact eligibility
  const compacts = await prisma.compactEligibility.findMany({
    where: { clinicianId },
  });

  for (const compact of compacts) {
    events.push({
      id: `compact-${compact.id}`,
      type: 'compact',
      timestamp: compact.createdAt.toISOString(),
      source: compact.compact,
      data: {
        compact: compact.compact,
        eligible: compact.eligible,
        rationale: compact.rationale,
      },
      verified: compact.eligible,
    });
  }

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Task 341.3 — International timeline adapter
 * Adapt non-US timelines to standardized format.
 */
export function adaptInternationalTimeline(
  events: Array<{ country: string; type: string; timestamp: string; data: Record<string, unknown> }>,
): TimelineEvent[] {
  return events.map((event) => ({
    id: `intl-${event.country}-${Date.now()}`,
    type: mapInternationalType(event.type),
    timestamp: event.timestamp,
    source: event.country,
    data: {
      ...event.data,
      country: event.country,
    },
    verified: false, // International events need verification
  }));
}

function mapInternationalType(type: string): TimelineEvent['type'] {
  const mapping: Record<string, TimelineEvent['type']> = {
    medical_license: 'license',
    certification: 'board',
    employment: 'employment',
  };
  return mapping[type] || 'license';
}

/**
 * Task 341.5 — Missing-event detector v3
 * Identify gaps in timeline consistency.
 */
export function detectMissingEvents(events: TimelineEvent[]): Array<{ start: string; end: string; type: string }> {
  const gaps: Array<{ start: string; end: string; type: string }> = [];

  // Group events by type
  const byType = events.reduce((acc, event) => {
    if (!acc[event.type]) {
      acc[event.type] = [];
    }
    acc[event.type].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  // Check for gaps in license renewals (should renew every 2 years)
  const licenses = byType['license'] || [];
  for (let i = 0; i < licenses.length - 1; i++) {
    const current = new Date(licenses[i].timestamp);
    const next = new Date(licenses[i + 1].timestamp);
    const yearsDiff = (next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24 * 365);

    if (yearsDiff > 2.5) {
      gaps.push({
        start: licenses[i].timestamp,
        end: licenses[i + 1].timestamp,
        type: 'license_renewal_gap',
      });
    }
  }

  return gaps;
}

/**
 * Task 341.6 — Duplicate-event suppression
 * Prevent redundant events from multi-sources.
 */
export function detectDuplicates(events: TimelineEvent[]): Array<{ eventIds: string[]; type: string }> {
  const duplicates: Array<{ eventIds: string[]; type: string }> = [];
  const seen = new Map<string, string[]>();

  for (const event of events) {
    const key = `${event.type}-${event.timestamp.substring(0, 10)}-${JSON.stringify(event.data).substring(0, 50)}`;
    if (seen.has(key)) {
      seen.get(key)!.push(event.id);
    } else {
      seen.set(key, [event.id]);
    }
  }

  for (const [key, ids] of seen.entries()) {
    if (ids.length > 1) {
      duplicates.push({
        eventIds: ids,
        type: key.split('-')[0],
      });
    }
  }

  return duplicates;
}

/**
 * Task 341.7 — Multi-chain timeline validator
 * Confirm timeline integrity with block events.
 */
export async function validateTimelineIntegrity(clinicianId: string, events: TimelineEvent[]): Promise<{
  score: number;
  issues: string[];
}> {
  const issues: string[] = [];
  let score = 1.0;

  // Check chain hashes
  const eventsWithChain = events.filter((e) => e.chainHash);
  const chainCoverage = eventsWithChain.length / events.length;
  score *= chainCoverage;

  if (chainCoverage < 0.5) {
    issues.push('Low chain coverage - many events not anchored');
  }

  // Check for verified events
  const verifiedCount = events.filter((e) => e.verified).length;
  const verificationRate = verifiedCount / events.length;
  score *= verificationRate;

  if (verificationRate < 0.7) {
    issues.push('Low verification rate');
  }

  // Check block proofs
  const blockProofs = await prisma.blockProof.findMany({
    where: {
      eventType: { in: events.map((e) => e.type) },
    },
  });

  const proofCoverage = blockProofs.length / events.length;
  score *= proofCoverage;

  if (proofCoverage < 0.3) {
    issues.push('Missing block proofs for many events');
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    issues,
  };
}

/**
 * Task 341.8 — Timeline intelligence engine
 * Predict upcoming timeline shifts.
 */
export function predictTimelineShifts(events: TimelineEvent[]): Array<{
  type: string;
  predictedDate: string;
  confidence: number;
  reason: string;
}> {
  const predictions: Array<{
    type: string;
    predictedDate: string;
    confidence: number;
    reason: string;
  }> = [];

  // Predict license renewals
  const licenses = events.filter((e) => e.type === 'license');
  for (const license of licenses) {
    const data = license.data as { expiresAt?: string };
    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt);
      const now = new Date();
      if (expiresAt > now && expiresAt.getTime() - now.getTime() < 90 * 24 * 60 * 60 * 1000) {
        predictions.push({
          type: 'license_renewal',
          predictedDate: expiresAt.toISOString(),
          confidence: 0.9,
          reason: 'License expires soon',
        });
      }
    }
  }

  return predictions;
}

/**
 * Task 341.9 — Timeline export pack
 * Global regulatory timeline export.
 */
export function exportTimelinePack(timeline: TimelineData): {
  format: string;
  data: Record<string, unknown>;
  hash: string;
} {
  const exportData = {
    events: timeline.events,
    gaps: timeline.gaps,
    duplicates: timeline.duplicates,
    integrity: timeline.integrity,
    exportedAt: new Date().toISOString(),
  };

  const hash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(exportData))
    .digest('hex');

  return {
    format: 'regulatory_timeline_v1',
    data: exportData,
    hash: `0x${hash}`,
  };
}

/**
 * Task 341.1 — Get or create timeline synthesis
 */
export async function getOrCreateTimeline(clinicianId: string): Promise<TimelineData> {
  let timeline = await prisma.credentialTimelineSynth.findUnique({
    where: { clinicianId },
  });

  if (!timeline) {
    const events = await unifyTimeline(clinicianId);
    const gaps = detectMissingEvents(events);
    const duplicates = detectDuplicates(events);
    const integrity = await validateTimelineIntegrity(clinicianId, events);

    const timelineData: TimelineData = {
      events,
      gaps,
      duplicates,
      integrity,
    };

    timeline = await prisma.credentialTimelineSynth.create({
      data: {
        clinicianId,
        timeline: timelineData,
      },
    });
  }

  return timeline.timeline as TimelineData;
}

/**
 * Task 341.10 — Anchor timeline synthesis snapshot
 */
export async function anchorTimelineSnapshot(clinicianId: string): Promise<string | null> {
  try {
    const timeline = await prisma.credentialTimelineSynth.findUnique({
      where: { clinicianId },
    });

    if (!timeline) {
      return null;
    }

    const timelineData = timeline.timeline as TimelineData;

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'credentialTimelineAnchored',
      payload: {
        clinicianId,
        eventCount: timelineData.events.length,
        gapCount: timelineData.gaps.length,
        duplicateCount: timelineData.duplicates.length,
        integrityScore: timelineData.integrity.score,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[timeline] anchor failed', error);
    return null;
  }
}

