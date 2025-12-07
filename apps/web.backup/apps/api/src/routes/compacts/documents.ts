import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ingestCompactDocument } from '../../services/compacts/doc-ingest';

const prisma = new PrismaClient();
const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const documents = await prisma.compactDocument.findMany({
      where: { clinicianId: req.params.clinicianId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ clinicianId: req.params.clinicianId, documents });
  } catch (error) {
    console.error('[Compacts][documents] list failed', error);
    return res.status(500).json({
      error: 'compact_documents_list_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const payload = {
      clinicianId: req.params.clinicianId,
      compact: String(req.body?.compact ?? ''),
      documentUrl: String(req.body?.documentUrl ?? ''),
      fileName: String(req.body?.fileName ?? ''),
      mimeType: String(req.body?.mimeType ?? ''),
      sizeBytes: typeof req.body?.sizeBytes === 'number' ? req.body.sizeBytes : undefined,
      metadata:
        typeof req.body?.metadata === 'object' && req.body.metadata ? req.body.metadata : undefined,
    };
    const document = await ingestCompactDocument(payload);
    return res.status(201).json(document);
  } catch (error) {
    console.error('[Compacts][documents] ingest failed', error);
    return res.status(400).json({
      error: 'compact_document_ingest_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;










