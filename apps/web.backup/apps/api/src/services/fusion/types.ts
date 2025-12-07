import type { Prisma, PrismaClient } from '@prisma/client';
import type { AnchorRecord } from '../audit/anchor';

export type FusionSourceType =
  | 'us_license'
  | 'global_license'
  | 'dea_mate'
  | 'compact'
  | 'employment';

export type FusionComponentStatus = 'active' | 'expired' | 'revoked' | 'pending';

export interface FusionSourceSnapshot {
  usLicenses: Prisma.StateLicenseVerificationGetPayload<{}>[];
  globalLicenses: Prisma.GlobalLicenseGetPayload<{}>[];
  dea: Prisma.DEACredentialGetPayload<{}>[];
  compacts: Prisma.CompactEligibilityGetPayload<{}>[];
  employment: Prisma.CredentialGetPayload<{}>[];
}

export interface FusionTimelineEvent {
  id: string;
  componentId: string;
  type: FusionSourceType;
  label: string;
  status: FusionComponentStatus;
  occurredAt: string;
  context?: string;
}

export interface FusionSourceRef {
  sourceId: string;
  type: FusionSourceType;
  trust: number;
  updatedAt?: string;
  anchor?: string | null;
  issuer?: string | null;
  issuerDid?: string | null;
  summary: Record<string, unknown>;
}

export interface FusionComponent {
  id: string;
  type: FusionSourceType;
  key: string;
  label: string;
  status: FusionComponentStatus;
  fields: Record<string, unknown>;
  chosenSourceId: string;
  metrics: {
    trust: number;
    recency: number;
    anchor: number;
    score: number;
  };
  sources: FusionSourceRef[];
}

export interface FusionDiffEntry {
  componentId: string;
  label: string;
  fused: Record<string, unknown>;
  inputs: FusionSourceRef[];
}

export interface FusionConflict {
  id: string;
  type: 'date_mismatch' | 'name_drift' | 'specialty_inconsistent';
  severity: 'low' | 'medium' | 'high';
  message: string;
  affectedComponentIds: string[];
  evidence?: Record<string, unknown>;
}

export interface FusionResolution {
  conflictId: string;
  selectedComponentId: string;
  policy: 'issuer_trust' | 'recency' | 'anchor';
  rationale: string[];
}

export interface FusionValidationFinding {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  componentId?: string;
  field?: string;
}

export interface FusedCredentialRecord {
  clinicianId: string;
  generatedAt: string;
  summary: {
    componentCount: number;
    activeComponents: number;
    expiredComponents: number;
    sourceCount: number;
  };
  components: FusionComponent[];
  timeline: FusionTimelineEvent[];
  diff: FusionDiffEntry[];
  rootHash: string;
}

export interface FusionPipelineResult {
  clinicianId: string;
  generatedAt: string;
  sources: FusionSourceSnapshot;
  fused: FusedCredentialRecord;
  conflicts: FusionConflict[];
  resolutions: FusionResolution[];
  validations: FusionValidationFinding[];
  anchor?: AnchorRecord;
  fhirBundle?: Record<string, unknown>;
}

export interface FusionPipelineOptions {
  prisma?: PrismaClient;
  now?: Date;
  persist?: boolean;
  includeBundle?: boolean;
  skipAnchor?: boolean;
}

export interface FusionCandidate {
  sourceId: string;
  type: FusionSourceType;
  key: string;
  label: string;
  status: FusionComponentStatus;
  issuer?: string | null;
  issuerDid?: string | null;
  trustWeight?: number;
  updatedAt?: string;
  anchor?: string | null;
  payload: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface PolicyDecision {
  selected: FusionCandidate;
  metrics: FusionComponent['metrics'];
  policy: FusionResolution['policy'];
  rationale: string[];
}

export interface PolicyContext {
  now: Date;
  trustDirectory: Map<string, number>;
  defaultTrust: number;
}









