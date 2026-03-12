/**
 * documents.ts — Wave 237: Document Intelligence API
 *
 * Routes:
 *   POST /api/documents/parse   — upload a file, run OCR + extraction, return result
 *   POST /api/documents/verify  — verify an extracted document against primary sources
 *   GET  /api/documents/:id     — retrieve a stored extraction result by documentId
 *
 * Auth: all routes require `x-clerk-user-id` header.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { documentPipeline, type DocumentExtractionResult } from '../services/ai/documentPipeline';
import { sourceVerifier } from '../services/ai/sourceVerifier';
import { log } from '../obs/logger';

// ── In-memory extraction store (keyed by documentId) ──────────────
const extractionStore = new Map<string, DocumentExtractionResult>();

// ── Multer config: memory storage, 10 MB limit ────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Auth middleware: require x-clerk-user-id ───────────────────────
function requireClerkUser(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-clerk-user-id'];
  if (!userId || (typeof userId === 'string' && userId.trim() === '')) {
    res.status(401).json({
      error: 'unauthorized',
      error_description: 'x-clerk-user-id header is required',
    });
    return;
  }
  next();
}

// ── Route registration ─────────────────────────────────────────────

export function registerDocumentRoutes(app: Express): void {

  /**
   * POST /api/documents/parse
   * Accepts a multipart/form-data file upload (field name: "file").
   * Runs OCR + field extraction via documentPipeline.
   * Stores result in memory and returns it.
   */
  app.post(
    '/api/documents/parse',
    requireClerkUser,
    upload.single('file'),
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No file uploaded. Send a multipart/form-data request with field "file".' });
          return;
        }

        const { buffer, mimetype, originalname, size } = req.file;

        log('info', 'document_parse_start', {
          originalname,
          mimetype,
          sizeBytes: size,
          userId: req.headers['x-clerk-user-id'],
        });

        const result = await documentPipeline.extractFromDocument(buffer, mimetype);

        // Persist in-memory for subsequent verify/lookup
        extractionStore.set(result.documentId, result);

        log('info', 'document_parse_complete', {
          documentId: result.documentId,
          documentType: result.documentType,
          overallConfidence: result.overallConfidence,
          processingTimeMs: result.processingTimeMs,
        });

        res.status(200).json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Document parse failed';
        log('error', 'document_parse_error', {
          error: message,
          userId: req.headers['x-clerk-user-id'],
        });
        res.status(500).json({ error: message });
      }
    },
  );

  /**
   * POST /api/documents/verify
   * Body: { documentId: string, npi?: string }
   * Retrieves the stored extraction, optionally injects the provided NPI,
   * then runs primary-source verification via sourceVerifier.verifyDocument().
   */
  app.post(
    '/api/documents/verify',
    requireClerkUser,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : '';
        const npi = typeof body.npi === 'string' ? body.npi.trim() : '';

        if (!documentId) {
          res.status(400).json({ error: 'documentId is required' });
          return;
        }

        const extraction = extractionStore.get(documentId);
        if (!extraction) {
          res.status(404).json({ error: `No extraction found for documentId: ${documentId}` });
          return;
        }

        // If caller provides an NPI, inject/override it in the extraction fields
        let effectiveExtraction = extraction;
        if (npi) {
          const existingFields = extraction.extractedFields.filter((f) => f.field !== 'npi');
          effectiveExtraction = {
            ...extraction,
            extractedFields: [
              ...existingFields,
              { field: 'npi', value: npi, confidence: 1.0 },
            ],
          };
        }

        log('info', 'document_verify_start', {
          documentId,
          npi: npi || '(not provided)',
          userId: req.headers['x-clerk-user-id'],
        });

        const result = await sourceVerifier.verifyDocument(effectiveExtraction);

        log('info', 'document_verify_complete', {
          documentId,
          verified: result.verified,
          overallMatch: result.overallMatch,
          discrepancies: result.discrepancies.length,
        });

        res.status(200).json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Document verification failed';
        log('error', 'document_verify_error', {
          error: message,
          userId: req.headers['x-clerk-user-id'],
        });
        res.status(500).json({ error: message });
      }
    },
  );

  /**
   * GET /api/documents/:id
   * Returns the stored extraction result for the given documentId.
   */
  app.get(
    '/api/documents/:id',
    requireClerkUser,
    (req: Request, res: Response): void => {
      const { id } = req.params;

      const extraction = extractionStore.get(id);
      if (!extraction) {
        res.status(404).json({ error: `No document found with id: ${id}` });
        return;
      }

      log('info', 'document_get', {
        documentId: id,
        userId: req.headers['x-clerk-user-id'],
      });

      res.status(200).json(extraction);
    },
  );
}
