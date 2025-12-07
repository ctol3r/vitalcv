import { PrismaClient, AuditEvidence } from '@prisma/client';
import { listAnchorEvents } from './anchor';
import { getBlockProofsForEvents } from '../chain/proofs';

const prisma = new PrismaClient();

export interface CredentialLifecycleEvent {
  id: string;
  label: string;
  occurredAt: string;
  status: 'granted' | 'verified' | 'expired';
  metadata?: Record<string, any>;
}

export interface ChainProof {
  anchorId: string;
  txHash: string;
  network: string;
  recordedAt: string;
  type: string;
  blockHash: string;
  merklePath: string[];
  palletName?: string;
}

export interface VcMetadata {
  issuerDid: string;
  templateId: string;
  schemaId: string;
}

export interface RevocationStatusSummary {
  status: 'good' | 'revoked' | 'unknown';
  checkedAt: string;
  reason?: string;
}

export interface AuditPacketArtifacts {
  json: string;
  pdfBase64: string;
  pdfFileName: string;
}

export interface AuditPacket {
  clinicianId: string;
  generatedAt: string;
  evidence: Record<string, AuditEvidence[]>;
  credentialLifecycle: CredentialLifecycleEvent[];
  chainProofs: ChainProof[];
  vcMetadata: VcMetadata;
  revocationStatus: RevocationStatusSummary;
  artifacts: AuditPacketArtifacts;
}

export async function buildAuditPacket(clinicianId: string): Promise<AuditPacket> {
  const evidenceRecords = await prisma.auditEvidence.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'asc' },
  });

  const evidenceByCategory = evidenceRecords.reduce<Record<string, AuditEvidence[]>>(
    (acc, record) => {
      acc[record.category] = acc[record.category] || [];
      acc[record.category].push(record);
      return acc;
    },
    {},
  );

  const credentialLifecycle = deriveLifecycleEvents(evidenceRecords);
  const anchorEvents = listAnchorEvents({ clinicianId });
  const blockProofRecords = await getBlockProofsForEvents(anchorEvents.map((event) => event.id));
  const proofMap = new Map(blockProofRecords.map((record: any) => [record.eventId, record]));

  const chainProofs: ChainProof[] = anchorEvents.map((anchor) => {
    const stored = proofMap.get(anchor.id);
    return {
      anchorId: anchor.id,
      txHash: anchor.txHash,
      network: anchor.network,
      recordedAt: anchor.payload.timestamp,
      type: anchor.type,
      blockHash: stored?.blockHash ?? anchor.txHash,
      merklePath: stored?.merklePath ?? anchor.merklePath ?? [],
      palletName: stored?.palletName ?? 'audit.scrapbook',
    };
  });

  const vcMetadata = buildVcMetadata(clinicianId);
  const revocationStatus = deriveRevocationStatus(chainProofs);

  const generatedAt = new Date().toISOString();
  const jsonPayload = JSON.stringify(
    {
      clinicianId,
      generatedAt,
      evidence: evidenceByCategory,
      credentialLifecycle,
      chainProofs,
      vcMetadata,
      revocationStatus,
    },
    null,
    2,
  );

  const pdfBase64 = await buildPdfArtifact(
    clinicianId,
    generatedAt,
    credentialLifecycle,
    chainProofs,
    vcMetadata,
    revocationStatus,
  );

  return {
    clinicianId,
    generatedAt,
    evidence: evidenceByCategory,
    credentialLifecycle,
    chainProofs,
    vcMetadata,
    revocationStatus,
    artifacts: {
      json: jsonPayload,
      pdfBase64,
      pdfFileName: `ncqa-audit-${clinicianId}.pdf`,
    },
  };
}

function deriveLifecycleEvents(records: AuditEvidence[]): CredentialLifecycleEvent[] {
  const events: CredentialLifecycleEvent[] = [];

  records.forEach((record) => {
    if (record.category === 'CR1') {
      const licenses = (record.payload as any)?.licenses ?? [];
      licenses.forEach((license: any) => {
        events.push({
          id: `${record.id}-${license.credentialId}`,
          label: `${license.jurisdiction} License`,
          occurredAt: license.expiresAt,
          status: license.status === 'active' ? 'verified' : 'expired',
          metadata: license,
        });
      });
    }

    if (record.category === 'CR3') {
      const psvResults = (record.payload as any)?.psvResults ?? [];
      psvResults.forEach((psv: any) => {
        events.push({
          id: `${record.id}-${psv.source}`,
          label: `PSV ${psv.source}`,
          occurredAt: psv.completedAt,
          status: psv.outcome === 'pass' ? 'verified' : 'expired',
          metadata: psv,
        });
      });
    }
  });

  return events.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}

function buildVcMetadata(clinicianId: string): VcMetadata {
  const issuerDid =
    process.env.ISSUER_DID ||
    process.env.NEXT_PUBLIC_ISSUER_DID ||
    'did:web:vitalcv.demo/issuer';

  return {
    issuerDid,
    templateId: 'clinical-core-v1',
    schemaId: 'https://schemas.vitalcv.health/clinical-core-v1',
  };
}

function deriveRevocationStatus(chainProofs: ChainProof[]): RevocationStatusSummary {
  if (!chainProofs.length) {
    return {
      status: 'unknown',
      checkedAt: new Date().toISOString(),
      reason: 'no_anchor_events',
    };
  }

  const latest = chainProofs[0];
  return {
    status: 'good',
    checkedAt: latest.recordedAt,
    reason: undefined,
  };
}

async function buildPdfArtifact(
  clinicianId: string,
  generatedAt: string,
  lifecycle: CredentialLifecycleEvent[],
  chainProofs: ChainProof[],
  vcMetadata: VcMetadata,
  revocation: RevocationStatusSummary,
): Promise<string> {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('NCQA Audit Packet v3', 14, 20);
    doc.setFontSize(11);
    doc.text(`Clinician: ${clinicianId}`, 14, 32);
    doc.text(`Generated: ${generatedAt}`, 14, 40);

    doc.setFontSize(13);
    doc.text('Credential Lifecycle', 14, 58);
    doc.setFontSize(10);

    let y = 68;
    lifecycle.forEach((event) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${event.occurredAt.slice(0, 10)} — ${event.label} (${event.status})`, 14, y);
      y += 8;
    });

    if (y > 260) {
      doc.addPage();
      y = 20;
    } else {
      y += 10;
    }

    doc.setFontSize(13);
    doc.text('VC Metadata', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Issuer DID: ${vcMetadata.issuerDid}`, 14, y);
    y += 6;
    doc.text(`Template: ${vcMetadata.templateId}`, 14, y);
    y += 6;
    doc.text(`Schema: ${vcMetadata.schemaId}`, 14, y);
    y += 10;

    doc.setFontSize(13);
    doc.text('Revocation Status', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Status: ${revocation.status}`, 14, y);
    y += 6;
    doc.text(`Checked: ${revocation.checkedAt}`, 14, y);
    y += 10;

    doc.setFontSize(13);
    doc.text('Chain Proofs', 14, y);
    y += 8;
    doc.setFontSize(10);

    chainProofs.forEach((proof) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(
        `${proof.recordedAt.slice(0, 19)} — ${proof.type} (${proof.txHash.slice(0, 12)}...)`,
        14,
        y,
      );
      y += 8;
      if (proof.merklePath.length) {
        doc.text(`Merkle path: ${proof.merklePath.map((node) => node.slice(0, 8)).join(' / ')}`, 16, y);
        y += 6;
      }
    });

    const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
    return Buffer.from(arrayBuffer).toString('base64');
  } catch {
    const fallback = [
      'NCQA AUDIT PACKET',
      `Clinician: ${clinicianId}`,
      `Generated: ${generatedAt}`,
      `Lifecycle events: ${lifecycle.length}`,
      `Chain proofs: ${chainProofs.length}`,
      `VC issuer: ${vcMetadata.issuerDid}`,
      `Revocation: ${revocation.status}`,
    ].join('\n');
    return Buffer.from(fallback, 'utf8').toString('base64');
  }
}

