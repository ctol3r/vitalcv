import { CommitteePacketStatus as PrismaStatus } from '@prisma/client';
import { z } from 'zod';

export const CommitteePacketStatus = {
  GENERATED: 'GENERATED',
  REGENERATED: 'REGENERATED',
  EXPORTED: 'EXPORTED',
  SUBMITTED: 'SUBMITTED',
} as const satisfies Record<string, PrismaStatus>;

export type CommitteePacketStatus = PrismaStatus;

export interface CommitteePacketRecord {
  id: string;
  clinicianId: string;
  packetId: string;
  snapshotAt: Date;
  status: CommitteePacketStatus;
  metadataHash: string;
  storagePath: string;
  snapshotSize: number;
  encryptionKeyVersion: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  anchorTxHash: string | null;
  anchoredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentitySection {
  npi: string;
  fullName?: string | null;
  specialty?: string | null;
  state?: string | null;
  did?: string | null;
  caqhId?: string | null;
  level?: number;
  tags?: Record<string, unknown>;
}

export interface LicenseEntry {
  state: string;
  licenseNumber: string;
  status: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  disciplinaryFlag?: boolean;
}

export interface CredentialEntry {
  id: string;
  type: string;
  status: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  issuer?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PayerEnrollmentEntry {
  id: string;
  payerName: string;
  payerId: string;
  status: string;
  panelType?: string | null;
  effectiveDate?: string | null;
  states?: string[];
  specialty?: string[];
  metadata?: Record<string, unknown>;
  updatedAt?: string | null;
}

export interface PrivilegeRequestEntry {
  id: string;
  status: string;
  privilegeSetName?: string | null;
  reviewerDid?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface PrivilegeGrantEntry {
  id: string;
  privilegeSetId: string;
  status: string;
  grantedAt: string;
  expiresAt: string;
  renewalDue?: string | null;
}

export interface QualityEntry {
  type: 'FPPE' | 'OPPE';
  status: string;
  notes?: string | null;
  dueAt?: string | null;
  updatedAt?: string | null;
}

export interface RiskSummary {
  score: number;
  factors: string[];
  updatedAt: string;
}

export interface CommitteePacketTimeline {
  events: Array<{
    id: string;
    phase: string;
    title: string;
    timestamp: string;
    status: string;
    metadata?: Record<string, unknown>;
  }>;
  phaseGroups: Array<{
    phase: string;
    events: Array<{ id: string; timestamp: string }>;
  }>;
}

export interface CommitteePacketDocument {
  clinicianId: string;
  generatedAt: string;
  sections: {
    identity: IdentitySection;
    licensure: LicenseEntry[];
    boardCertifications: CredentialEntry[];
    dea: CredentialEntry[];
    pecos?: Record<string, unknown> | null;
    medicaid?: Record<string, unknown> | null;
    payerEnrollments: PayerEnrollmentEntry[];
    privileges: {
      requests: PrivilegeRequestEntry[];
      active: PrivilegeGrantEntry[];
    };
    quality: QualityEntry[];
    risk?: RiskSummary | null;
    discrepancies: Array<{
      code: string;
      severity: string;
      message: string;
      recommendation?: string;
      context?: Record<string, unknown>;
    }>;
    timeline: CommitteePacketTimeline;
  };
}

export const CommitteePacketDocumentSchema = z.object({
  clinicianId: z.string(),
  generatedAt: z.string(),
  sections: z.object({
    identity: z.object({
      npi: z.string(),
      fullName: z.string().nullable().optional(),
      specialty: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      did: z.string().nullable().optional(),
      caqhId: z.string().nullable().optional(),
      level: z.number().int().optional(),
      tags: z.record(z.any()).nullable().optional(),
    }),
    licensure: z.array(
      z.object({
        state: z.string(),
        licenseNumber: z.string(),
        status: z.string(),
        issueDate: z.string().nullable().optional(),
        expiryDate: z.string().nullable().optional(),
        disciplinaryFlag: z.boolean().optional(),
      })
    ),
    boardCertifications: z.array(z.any()),
    dea: z.array(z.any()),
    pecos: z.record(z.any()).nullable().optional(),
    medicaid: z.record(z.any()).nullable().optional(),
    payerEnrollments: z.array(z.any()),
    privileges: z.object({
      requests: z.array(z.any()),
      active: z.array(z.any()),
    }),
    quality: z.array(z.any()),
    risk: z
      .object({
        score: z.number(),
        factors: z.array(z.string()),
        updatedAt: z.string(),
      })
      .nullable()
      .optional(),
    discrepancies: z.array(z.any()),
    timeline: z.object({
      events: z.array(
        z.object({
          id: z.string(),
          phase: z.string(),
          title: z.string(),
          timestamp: z.string(),
          status: z.string(),
          metadata: z.record(z.any()).optional(),
        })
      ),
      phaseGroups: z.array(
        z.object({
          phase: z.string(),
          events: z.array(
            z.object({
              id: z.string(),
              timestamp: z.string(),
            })
          ),
        })
      ),
    }),
  }),
});

export type ValidCommitteePacketDocument = z.infer<typeof CommitteePacketDocumentSchema>;
