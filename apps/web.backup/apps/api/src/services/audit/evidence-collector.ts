import { PrismaClient, AuditEvidence } from '@prisma/client';
import { anchorEvent } from './anchor';

const prisma = new PrismaClient();

export interface PsvResult {
  source: string;
  completedAt: string;
  outcome: 'pass' | 'fail' | 'pending';
  reviewer?: string;
  notes?: string;
}

export interface LicenseSnapshot {
  credentialId: string;
  jurisdiction: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'pending';
}

export interface SanctionFinding {
  source: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  cleared?: boolean;
}

export interface VerificationEvent {
  anchorTx: string;
  proofType: string;
  verifiedAt: string;
  verifier: string;
}

export interface EvidenceCollectorInput {
  clinicianId: string;
  psvResults: PsvResult[];
  licenseSnapshots: LicenseSnapshot[];
  sanctions: SanctionFinding[];
  verificationEvents: VerificationEvent[];
}

export async function collectAuditEvidence(
  input: EvidenceCollectorInput,
): Promise<AuditEvidence[]> {
  const entries: { category: string; payload: Record<string, any> }[] = [
    {
      category: 'CR1',
      payload: { licenses: input.licenseSnapshots },
    },
    {
      category: 'CR2',
      payload: { sanctions: input.sanctions },
    },
    {
      category: 'CR3',
      payload: { psvResults: input.psvResults },
    },
    {
      category: 'CR4',
      payload: { verificationEvents: input.verificationEvents },
    },
    {
      category: 'CR5',
      payload: {
        attestation: 'Complete NCQA evidence bundle generated from automated sources',
        generatedAt: new Date().toISOString(),
      },
    },
  ];

  const records: AuditEvidence[] = [];

  for (const entry of entries) {
    const record = await prisma.auditEvidence.create({
      data: {
        clinicianId: input.clinicianId,
        category: entry.category,
        payload: entry.payload,
      },
    });

    anchorEvent('auditEvidenceCommitted', {
      clinicianId: input.clinicianId,
      evidenceId: record.id,
      category: record.category,
    });

    records.push(record);
  }

  return records;
}










