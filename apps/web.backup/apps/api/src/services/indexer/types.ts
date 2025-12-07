import type { MasterCredentialIndex, PrismaClient } from '@prisma/client';
import type { AnchorRecord } from '../verify/anchor';

export type IndexCredentialType =
  | 'license'
  | 'board'
  | 'employment'
  | 'dea_mate'
  | 'compact';

export type IndexStatus = 'active' | 'expired' | 'revoked';

export interface IndexTimelineEvent {
  label: string;
  occurredAt: string;
  status: IndexStatus;
  context?: string;
}

export interface MasterIndexRow
  extends Pick<
    MasterCredentialIndex,
    'clinicianId' | 'credentialId' | 'credentialType' | 'issuerDid' | 'status'
  > {
  lastUpdated: string;
  summary: Record<string, unknown>;
  timeline: IndexTimelineEvent[];
  hash: string;
}

export interface IndexStatusSummary {
  total: number;
  byStatus: Record<IndexStatus, number>;
  byType: Record<IndexCredentialType, number>;
}

export interface IndexSnapshot {
  clinicianId: string;
  generatedAt: string;
  rows: MasterIndexRow[];
  map: Record<IndexCredentialType, MasterIndexRow[]>;
  stats: IndexStatusSummary;
  snapshotHash: string;
  anchor?: AnchorRecord;
}

export interface IndexBuildOptions {
  prisma?: PrismaClient;
  now?: Date;
  skipPersist?: boolean;
}


