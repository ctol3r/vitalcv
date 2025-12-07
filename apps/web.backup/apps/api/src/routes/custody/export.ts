import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import {
  getRecentCustodyEvents,
  groupTimelineByDocument,
  listCustodyTimeline,
  summarizeCustodyHeatmap,
} from '../../services/custody/log';
import { detectCustodyBreaches } from '../../services/custody/breach';
import { stitchCustodyBlock, deriveCustodyLeafHash, buildMerkleRoot } from '../../services/custody/stitch';
import { linkDocumentToCredential } from '../../services/custody/link-doc';
import { anchorCustodySnapshot } from '../../services/custody/snapshot';

const prisma = new PrismaClient();
const router = Router();

router.get('/custody/heatmap/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({ error: 'clinician_id_required' });
  }

  const windowDays = normalizeWindow(req.query.window);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  try {
    const records = await listCustodyTimeline({
      clinicianId,
      since,
      direction: 'asc',
    });
    const summary = summarizeCustodyHeatmap(records, windowDays);
    return res.json({
      clinicianId,
      ...summary,
      latestEvents: records.slice(-25).reverse(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[custody][heatmap] failed', error);
    return res.status(500).json({
      error: 'custody_heatmap_failed',
      message: error instanceof Error ? error.message : 'Unable to build custody heatmap',
    });
  }
});

router.get('/custody/stream', async (req: Request, res: Response) => {
  const clinicianId =
    typeof req.query.clinicianId === 'string' ? req.query.clinicianId : undefined;
  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  const limit = normalizeLimit(req.query.limit);

  try {
    const events = await getRecentCustodyEvents(limit, { clinicianId, documentId });
    return res.json({
      events,
      count: events.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[custody][stream] failed', error);
    return res.status(500).json({
      error: 'custody_stream_failed',
      message: error instanceof Error ? error.message : 'Unable to load custody stream',
    });
  }
});

router.get('/custody/export/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Clinician identifier is required',
    });
  }

  try {
    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      select: {
        id: true,
        orgId: true,
        npi: true,
        state: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!clinician) {
      return res.status(404).json({
        error: 'clinician_not_found',
        message: `Clinician ${clinicianId} not found`,
      });
    }

    const timeline = await listCustodyTimeline({ clinicianId, direction: 'asc' });
    const documents = await buildDocumentSummaries(clinicianId, timeline);
    const breaches = await detectCustodyBreaches({ timeline });

    const leafHashes = timeline.map(deriveCustodyLeafHash);
    const custodyRoot = leafHashes.length ? buildMerkleRoot(leafHashes) : null;

    let anchorReceipt: Awaited<ReturnType<typeof anchorCustodySnapshot>>['receipt'] | null = null;
    if (req.query.anchor === 'true' && timeline.length) {
      try {
        const snapshot = await anchorCustodySnapshot({ clinicianId, timeline });
        anchorReceipt = snapshot.receipt;
      } catch (anchorError) {
        console.warn('[custody][export] snapshot anchor failed', anchorError);
      }
    }

    const payload = {
      clinician: {
        id: clinician.id,
        orgId: clinician.orgId,
        npi: clinician.npi,
        state: clinician.state,
        name: clinician.user?.name ?? null,
        contactEmail: clinician.user?.email ?? null,
      },
      totals: {
        documents: documents.length,
        events: timeline.length,
      },
      custodyRoot,
      documents,
      breaches,
      anchorReceipt,
      generatedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Disposition', `attachment; filename="custody-${clinicianId}.json"`);
    return res.json(payload);
  } catch (error) {
    console.error('[custody][export] failed', error);
    return res.status(500).json({
      error: 'custody_export_failed',
      message: error instanceof Error ? error.message : 'Unable to export custody ledger',
    });
  }
});

async function buildDocumentSummaries(
  clinicianId: string,
  timeline: Awaited<ReturnType<typeof listCustodyTimeline>>,
) {
  const grouped = groupTimelineByDocument(timeline);
  const summaries = await Promise.all(
    Object.entries(grouped).map(async ([documentId, entries]) => {
      const block = stitchCustodyBlock(entries);
      const link = await linkDocumentToCredential({
        clinicianId,
        documentId,
        timeline: entries,
      });
      return {
        documentId,
        entryCount: entries.length,
        firstSeen: entries[0]?.timestamp ?? null,
        lastSeen: entries[entries.length - 1]?.timestamp ?? null,
        latestAction: entries[entries.length - 1]?.action ?? null,
        block,
        link,
      };
    }),
  );

  return summaries.sort((a, b) => {
    const left = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
    const right = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
    return right - left;
  });
}

function normalizeWindow(value: unknown): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.max(Math.trunc(parsed), 7), 90);
  }
  return 14;
}

function normalizeLimit(value: unknown): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.trunc(parsed), 200);
  }
  return 50;
}

export default router;










