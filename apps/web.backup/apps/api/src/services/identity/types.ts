import type { Prisma } from '@prisma/client';

export type IdentitySourceType = 'nppes' | 'state_board' | 'npdb' | 'ahpra' | 'gmc' | 'nmc';

export interface IdentitySourceRecord {
  source: IdentitySourceType;
  clinicianId: string;
  referenceId: string;
  fetchedAt: string;
  confidence: number;
  attributes: {
    name?: string | null;
    aliases?: string[];
    birthDate?: string | null;
    graduationYear?: number | null;
    specialties?: string[];
    licenseNumbers?: string[];
    location?: {
      city?: string | null;
      state?: string | null;
      country?: string | null;
    };
    metadata?: Record<string, unknown>;
  };
  raw: Record<string, unknown>;
}

export interface IdentityIngestionResult {
  clinicianId: string;
  fetchedAt: string;
  sources: IdentitySourceRecord[];
}

export interface IdentityMatchEntry {
  sourceA: IdentitySourceType;
  sourceB: IdentitySourceType;
  probability: number;
  evidence: string[];
}

export interface IdentityConflict {
  id: string;
  type: 'graduation_year_mismatch' | 'specialty_inconsistent' | 'name_variation';
  field: 'graduationYear' | 'specialties' | 'name';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  contenders: Array<{
    source: IdentitySourceType;
    value: string | number | null;
    confidence: number;
  }>;
  resolution?: {
    value: string | number | null;
    rationale: string[];
    confidence: number;
  };
}

export interface IdentityLineageEdge {
  id: string;
  fromSource: IdentitySourceType;
  toField: string;
  weight: number;
  fromNodeId: string;
  toNodeId: string;
  evidence?: string;
}

export interface IdentityLineageGraph {
  nodes: Array<{
    id: string;
    label: string;
    type: 'source' | 'field';
    weight: number;
  }>;
  edges: IdentityLineageEdge[];
}

export interface IdentityReliabilityBreakdown {
  overall: number;
  coverage: number;
  recency: number;
  agreement: number;
  validationDensity: number;
}

export interface IdentityFusionPayload {
  clinicianId: string;
  generatedAt: string;
  primaryName: string | null;
  normalizedName: string | null;
  aliases: string[];
  birthDate: string | null;
  graduationYear: number | null;
  specialties: string[];
  sourceBreakdown: Record<IdentitySourceType, number>;
  reliability: IdentityReliabilityBreakdown;
  matchMatrix: IdentityMatchEntry[];
  conflicts: IdentityConflict[];
  lineage: IdentityLineageGraph;
  transparency: Array<{
    field: string;
    winningSource: IdentitySourceType | null;
    supportingSources: IdentitySourceType[];
    rationale: string[];
    confidence: number;
  }>;
}

export interface IdentityFusionOptions {
  prisma?: Prisma.PrismaClient;
  now?: Date;
  persist?: boolean;
  skipAnchor?: boolean;
}


