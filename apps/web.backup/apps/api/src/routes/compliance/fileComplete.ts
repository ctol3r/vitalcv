import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { listAnchorEvents, anchorEvent } from '../../services/audit/anchor';
import { buildAuditPacket } from '../../services/audit/packet-builder';

const REQUIRED_CATEGORIES = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'];
const FRESHNESS_DAYS = Number(process.env.NCQA_EVIDENCE_FRESHNESS_DAYS || 90);

const prisma = new PrismaClient();
const router = Router();

router.post('/file-complete/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;

  try {
    const evidence = await prisma.auditEvidence.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'asc' },
    });

    const summary = summarizeEvidence(evidence);
    const missingCategories = REQUIRED_CATEGORIES.filter((category) => !summary[category]);
    const staleCategories = Object.entries(summary)
      .filter(([, details]) => evidenceIsStale(details.latestAt))
      .map(([category]) => category);

    const anchors = listAnchorEvents({ clinicianId });
    const auditAnchors = anchors.filter((anchor) =>
      ['auditEvidenceCommitted', 'ncqaFileComplete'].includes(anchor.type),
    );

    const isComplete =
      missingCategories.length === 0 && staleCategories.length === 0 && auditAnchors.length > 0;

    let packetArtifacts = null;
    if (isComplete) {
      anchorEvent('ncqaFileComplete', { clinicianId });
      const packet = await buildAuditPacket(clinicianId);
      packetArtifacts = packet.artifacts;
    }

    return res.json({
      clinicianId,
      ready: isComplete,
      missingCategories,
      staleCategories,
      evidenceSummary: summary,
      anchorCount: auditAnchors.length,
      anchors: auditAnchors,
      packetArtifacts,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[compliance:file-complete] failed', error);
    return res.status(500).json({
      error: 'FILE_COMPLETE_FAILED',
      message: error instanceof Error ? error.message : 'Unknown failure',
    });
  }
});

function summarizeEvidence(
  records: Awaited<ReturnType<typeof prisma.auditEvidence.findMany>>,
) {
  return records.reduce<Record<string, { count: number; latestAt: string }>>((acc, record) => {
    acc[record.category] = acc[record.category] || { count: 0, latestAt: record.createdAt.toISOString() };
    acc[record.category].count += 1;
    acc[record.category].latestAt = record.createdAt.toISOString();
    return acc;
  }, {});
}

function evidenceIsStale(latestAt: string) {
  const latest = new Date(latestAt).getTime();
  const freshnessWindow = FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - latest > freshnessWindow;
}

export default router;










