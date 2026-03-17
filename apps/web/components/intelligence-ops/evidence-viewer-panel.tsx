'use client';

import {
  EvidenceViewer,
  type EvidenceItem,
  type EvidenceQuality,
} from '@/components/evidence/EvidenceViewer';

interface EvidenceViewerPanelProps {
  evidence: EvidenceItem[];
  findingId: string | null;
  onQualitySubmit?: (findingId: string, quality: EvidenceQuality) => void;
  selectedEvidenceIndex?: number | null;
}

export type { EvidenceItem, EvidenceQuality } from '@/components/evidence/EvidenceViewer';

export function EvidenceViewerPanel(props: EvidenceViewerPanelProps) {
  return <EvidenceViewer {...props} />;
}
