import { anchorEvent } from '../audit/anchor';
import type { TimelineAuditPack } from './export';

/**
 * Anchor timeline snapshot to blockchain
 */
export function anchorTimelineSnapshot(pack: TimelineAuditPack) {
  return anchorEvent('experienceTimelineAnchored', {
    clinicianId: pack.clinicianId,
    packHash: pack.packHash,
    eventCount: pack.timeline.events.length,
    milestoneCount: pack.timeline.milestones.length,
    complianceScore: pack.compliance.score,
    discrepancyCount: pack.discrepancies.length,
    generatedAt: pack.generatedAt,
  });
}

