import { PrismaClient } from '@prisma/client';
import type { TrustEvent } from './trajectory-ingest';

const prisma = new PrismaClient();

export interface TrustTrajectoryPoint {
  timestamp: Date;
  trustScore: number;
  confidence: number;
  factors: Array<{ name: string; weight: number; impact: number }>;
}

export interface TrustTrajectory {
  clinicianId: string;
  points: TrustTrajectoryPoint[];
  currentScore: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  volatility: number;
}

const DECAY_FACTOR = 0.95; // Exponential decay per day
const BASE_WEIGHTS = {
  issuer_trust_change: 0.3,
  employer_eval: 0.4,
  safety_event: 0.2,
  chain_issue: 0.1,
};

const EVENT_IMPACTS = {
  issuer_trust_change: {
    increased: 0.1,
    decreased: -0.15,
    maintained: 0,
  },
  employer_eval: {
    positive: 0.05,
    neutral: 0,
    negative: -0.1,
  },
  safety_event: {
    low: -0.02,
    medium: -0.05,
    high: -0.1,
    critical: -0.2,
  },
  chain_issue: {
    resolved: 0,
    unresolved: -0.05,
  },
};

/**
 * Compute trust trajectory with weighted decay
 */
export async function computeTrustTrajectory(
  clinicianId: string,
  lookbackDays: number = 90,
): Promise<TrustTrajectory> {
  const trajectory = await prisma.providerTrustTrajectory.findUnique({
    where: { clinicianId },
  });

  if (!trajectory) {
    return {
      clinicianId,
      points: [],
      currentScore: 0.5, // Neutral default
      trend: 'stable',
      volatility: 0,
    };
  }

  const events = (trajectory.trajectory as Array<TrustEvent & { id: string }>).filter(
    (event) => {
      const eventDate = new Date(event.timestamp);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      return eventDate >= cutoffDate;
    },
  );

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Compute points with decay
  const points: TrustTrajectoryPoint[] = [];
  let currentScore = 0.5; // Start neutral
  const now = new Date();

  for (const event of events) {
    const eventDate = new Date(event.timestamp);
    const daysAgo = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
    const decay = Math.pow(DECAY_FACTOR, daysAgo);

    const weight = BASE_WEIGHTS[event.type] || 0.1;
    let impact = 0;

    if (event.type === 'issuer_trust_change') {
      const change = (event.data as { change: string }).change;
      impact = EVENT_IMPACTS.issuer_trust_change[change as keyof typeof EVENT_IMPACTS.issuer_trust_change] || 0;
    } else if (event.type === 'employer_eval') {
      const score = (event.data as { score: number }).score;
      if (score >= 0.7) impact = EVENT_IMPACTS.employer_eval.positive;
      else if (score >= 0.4) impact = EVENT_IMPACTS.employer_eval.neutral;
      else impact = EVENT_IMPACTS.employer_eval.negative;
    } else if (event.type === 'safety_event') {
      const severity = (event.data as { severity: string }).severity;
      impact = EVENT_IMPACTS.safety_event[severity as keyof typeof EVENT_IMPACTS.safety_event] || 0;
    } else if (event.type === 'chain_issue') {
      const resolved = (event.data as { resolved: boolean }).resolved;
      impact = resolved ? EVENT_IMPACTS.chain_issue.resolved : EVENT_IMPACTS.chain_issue.unresolved;
    }

    currentScore = Math.max(0, Math.min(1, currentScore + impact * weight * decay));

    points.push({
      timestamp: eventDate,
      trustScore: currentScore,
      confidence: decay,
      factors: [
        {
          name: event.type,
          weight,
          impact: impact * decay,
        },
      ],
    });
  }

  // Compute trend
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (points.length >= 2) {
    const recent = points.slice(-10);
    const first = recent[0]?.trustScore || 0.5;
    const last = recent[recent.length - 1]?.trustScore || 0.5;
    const diff = last - first;
    if (diff > 0.05) trend = 'increasing';
    else if (diff < -0.05) trend = 'decreasing';
  }

  // Compute volatility (standard deviation of score changes)
  let volatility = 0;
  if (points.length >= 2) {
    const changes = points.slice(1).map((p, i) => Math.abs(p.trustScore - points[i].trustScore));
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length;
    volatility = Math.sqrt(variance);
  }

  return {
    clinicianId,
    points,
    currentScore,
    trend,
    volatility,
  };
}

