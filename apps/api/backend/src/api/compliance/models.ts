export type EvidenceCategory =
  | 'audit'
  | 'anchor'
  | 'access'
  | 'credential'
  | 'control';

export type EvidenceRefType = 'hash' | 'anchor' | 'event' | 'count' | 'status';

export interface EvidenceReference {
  label: string;
  value: string;
  type?: EvidenceRefType;
  metadata?: Record<string, unknown>;
}

export interface EvidenceItem {
  id: string;
  category: EvidenceCategory;
  description: string;
  refs: EvidenceReference[];
}

export interface CompliancePack {
  type: 'soc2' | 'hipaa' | 'ncqa';
  generatedAt: string;
  items: EvidenceItem[];
  stats: {
    auditEvents: number;
    credentials: number;
    accessDenials: number;
  };
}
