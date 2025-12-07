import { createHash } from 'crypto';
import { anchorEvent } from '../audit/anchor';

/**
 * Anchor trust trajectory snapshot
 */
export function anchorTrustTrajectorySnapshot(payload: {
  clinicianId: string;
  trustTrajectoryHash: string;
  currentScore: number;
  trend: string;
  timestamp?: string;
}) {
  return anchorEvent('trustTrajectoryAnchored', {
    clinicianId: payload.clinicianId,
    trustTrajectoryHash: payload.trustTrajectoryHash,
    currentScore: Number(payload.currentScore.toFixed(4)),
    trend: payload.trend,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

