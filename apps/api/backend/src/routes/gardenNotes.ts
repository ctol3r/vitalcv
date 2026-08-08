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
import {
  createNoteLink,
  deleteNoteLink,
  listNoteBacklinks,
  listNoteLinks,
  listNoteRevisions,
  noteNeighborhood,
  restoreNoteRevision,
} from '../services/garden/gardenLinksService';
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

  // ——— CC-05 / WB-02: revisions and typed links ————————————————————————
  // Same contract as every route above: identity via requireInternalUserId,
  // rows scoped to the resolved user, misses read as 404, mutations audited
  // before the 2xx. Reads are not audited (matching notes/cv list behavior).

  app.get(
    '/api/profile/garden/notes/:noteId/revisions',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      res.json({ revisions: await listNoteRevisions(userId, req.params.noteId) });
    }),
  );

  app.post(
    '/api/profile/garden/notes/:noteId/revisions/:revisionId/restore',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const result = await restoreNoteRevision(userId, req.params.noteId, req.params.revisionId);
      await auditGarden('garden_note_revision_restored', userId, {
        noteId: req.params.noteId,
        revisionId: req.params.revisionId,
      });
      res.json(result);
    }),
  );

  app.get(
    '/api/profile/garden/notes/:noteId/links',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      res.json({ links: await listNoteLinks(userId, req.params.noteId) });
    }),
  );

  app.post(
    '/api/profile/garden/notes/:noteId/links',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const link = await createNoteLink(userId, req.params.noteId, req.body ?? {});
      await auditGarden('garden_note_link_created', userId, {
        linkId: link.id,
        fromNoteId: link.fromNoteId,
        targetType: link.targetType,
      });
      res.status(201).json({ link });
    }),
  );

  app.delete(
    '/api/profile/garden/links/:linkId',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const result = await deleteNoteLink(userId, req.params.linkId);
      await auditGarden('garden_note_link_removed', userId, { linkId: req.params.linkId });
      res.json(result);
    }),
  );

  app.get(
    '/api/profile/garden/notes/:noteId/backlinks',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      res.json({ backlinks: await listNoteBacklinks(userId, req.params.noteId) });
    }),
  );

  app.get(
    '/api/profile/garden/notes/:noteId/graph',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      res.json(await noteNeighborhood(userId, req.params.noteId));
    }),
  );
}
