import { createHash } from 'crypto';
import type { HarmonizedSanction } from './harmonization';
import type { AdverseActionLineage } from './lineage';
import type { CrossBorderMapping } from './cross-border';
import type { PredictedSanction } from './prediction';

export interface SanctionsAuditPacket {
  clinicianId: string;
  sanctions: HarmonizedSanction[];
  lineages: AdverseActionLineage[];
  crossBorderMappings: CrossBorderMapping[];
  predictions: PredictedSanction[];
  generatedAt: string;
  packetHash: string;
}

/**
 * Generate sanctions audit packet for compliance teams
 */
export function generateSanctionsAuditPacket(
  clinicianId: string,
  sanctions: HarmonizedSanction[],
  lineages: AdverseActionLineage[],
  crossBorderMappings: CrossBorderMapping[],
  predictions: PredictedSanction[],
): SanctionsAuditPacket {
  const packet = {
    clinicianId,
    sanctions,
    lineages,
    crossBorderMappings,
    predictions,
    generatedAt: new Date().toISOString(),
    packetHash: '',
  };

  const packetHash = createHash('sha256').update(JSON.stringify(packet)).digest('hex');

  return {
    ...packet,
    packetHash,
  };
}

