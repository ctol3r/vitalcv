import { anchorEvent } from '../audit/anchor';
import type { SanctionsAuditPacket } from './export';

/**
 * Anchor safety exchange hash to blockchain
 */
export function anchorSafetyExchange(packet: SanctionsAuditPacket) {
  return anchorEvent('safetyExchangeAnchored', {
    clinicianId: packet.clinicianId,
    packetHash: packet.packetHash,
    sanctionCount: packet.sanctions.length,
    lineageCount: packet.lineages.length,
    predictionCount: packet.predictions.length,
    generatedAt: packet.generatedAt,
  });
}

