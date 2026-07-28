import type { Express, NextFunction, Request, Response } from 'express';

import prisma from '../graphql/prisma_client';
import { sha256ForPayload } from '../utils/deterministic';
import {
  createGardenNote,
  deleteGardenCvEntry,
  deleteGardenNote,
  listGardenCvEntries,
  listGardenNotes,
  promoteGardenNote,
  updateGardenNote,
} from '../services/garden/gardenService';
import { requireInternalUserId } from './intake';

/**
 * Career Garden routes — the clinician's private notes and the Living CV
 * lines they explicitly grow from them.
 *
 * Deliberately mounted under `/api/profile/garden/*`:
 *  - the tenant guard already skips the `/api/profile/` clinician-personal
 *    family (a brand-new clinician has no org yet), and
 *  - identity resolves through `requireInternalUserId` from the intake
 *    family, so this file never reads identity headers itself and the
 *    header-trust ratchet stays flat.
 *
 * Privacy contract: no route here ever returns another user's rows (every
 * query is scoped by the resolved internal user id, and misses read as 404,
 * not 403), and nothing here shares, sends, or publishes a note.
 */

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

/**
 * Durable audit row before the 2xx — the anti-drift doctrine ("every
 * mutating action writes an AuditEvent before 2xx") lives at the route
 * layer so the audit-coverage gate can see it next to each handler.
 */
async function auditGarden(type: string, referenceId: string, metadata: Record<string, unknown>): Promise<void> {
  const hash = sha256ForPayload({ type, referenceId, metadata });
  await prisma.auditEvent.create({
    data: {
      type,
      hash,
      referenceId,
      metadata: JSON.parse(JSON.stringify(metadata)),
    },
  });
}

export function registerGardenRoutes(app: Express): void {
  app.get(
    '/api/profile/garden/notes',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      res.json({ notes: await listGardenNotes(userId) });
    }),
  );

  app.post(
    '/api/profile/garden/notes',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const note = await createGardenNote(userId, req.body ?? {});
      await auditGarden('garden_note_created', userId, { noteId: note.id });
      res.status(201).json({ note });
    }),
  );

  app.patch(
    '/api/profile/garden/notes/:noteId',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const note = await updateGardenNote(userId, req.params.noteId, req.body ?? {});
      await auditGarden('garden_note_updated', userId, { noteId: note.id });
      res.json({ note });
    }),
  );

  app.delete(
    '/api/profile/garden/notes/:noteId',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const result = await deleteGardenNote(userId, req.params.noteId);
      await auditGarden('garden_note_deleted', userId, { noteId: req.params.noteId });
      res.json(result);
    }),
  );

  app.post(
    '/api/profile/garden/notes/:noteId/promote',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const result = await promoteGardenNote(userId, req.params.noteId, req.body ?? {});
      await auditGarden('garden_note_promoted', userId, {
        noteId: result.note.id,
        entryId: result.entry.id,
        section: result.entry.section,
      });
      res.status(201).json(result);
    }),
  );

  app.get(
    '/api/profile/garden/cv',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      res.json({ entries: await listGardenCvEntries(userId) });
    }),
  );

  app.delete(
    '/api/profile/garden/cv/:entryId',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const result = await deleteGardenCvEntry(userId, req.params.entryId);
      await auditGarden('garden_cv_entry_removed', userId, {
        entryId: req.params.entryId,
        fromNoteId: result.fromNoteId,
      });
      res.json(result);
    }),
  );
}
