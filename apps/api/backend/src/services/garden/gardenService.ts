import type { Prisma } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';

/**
 * Career Garden persistence — private notes ("seeds") and the Living CV
 * lines a clinician explicitly grows from them.
 *
 * Truth contract:
 *  - Rows are scoped to the internal User.id resolved from the verified
 *    Clerk identity; every query filters on it, so cross-user access reads
 *    as not-found rather than forbidden (no existence leak).
 *  - `provenance` on a CV entry is the literal 'self_attested'. Callers
 *    cannot set it; promotion can never mint a source-backed claim.
 *  - Notes never leave this module by any path other than the clinician's
 *    explicit promote call.
 *  - Every mutation is audited in the route layer (routes/gardenNotes.ts)
 *    before the caller sees a 2xx — the audit-coverage gate pins that.
 */

export const GARDEN_NOTE_STATUSES = ['unfiled', 'growing', 'grown'] as const;
export type GardenNoteStatus = (typeof GARDEN_NOTE_STATUSES)[number];

export const GARDEN_CV_SECTIONS = ['experience', 'research', 'teaching', 'service', 'publications'] as const;
export type GardenCvSection = (typeof GARDEN_CV_SECTIONS)[number];

const MAX_TITLE = 200;
const MAX_BODY = 4000;
const MAX_TAGS = 8;
const MAX_TAG = 40;
const MAX_HEADLINE = 200;
const MAX_DETAIL = 600;

function cleanStr(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function cleanTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .map((t) => cleanStr(t, MAX_TAG))
    .filter((t): t is string => Boolean(t))
    .slice(0, MAX_TAGS);
  return tags;
}

export interface GardenNoteInput {
  title?: unknown;
  body?: unknown;
  tags?: unknown;
  status?: unknown;
}

// WB-06: the list is bounded and searchable. Defaults preserve the previous
// caller-visible behavior for small workspaces (newest first), but the read
// is never again unbounded: a daily-note habit is ~365 rows/year of 4KB
// bodies, and the workspace load path must not scale with note count.
const LIST_DEFAULT_LIMIT = 100;
const LIST_MAX_LIMIT = 200;
const MAX_QUERY = 200;

export interface GardenNoteListOptions {
  /** Case-insensitive substring match over title and body. */
  q?: unknown;
  /** Exact tag membership. */
  tag?: unknown;
  /** Opaque cursor: the `id` of the last note of the previous page. */
  cursor?: unknown;
  limit?: unknown;
}

export interface GardenNoteListResult {
  notes: Awaited<ReturnType<typeof prisma.gardenNote.findMany>>;
  nextCursor: string | null;
}

function cleanLimit(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  if (!Number.isInteger(n) || n < 1) return LIST_DEFAULT_LIMIT;
  return Math.min(n, LIST_MAX_LIMIT);
}

export async function listGardenNotes(
  userId: string,
  options: GardenNoteListOptions = {},
): Promise<GardenNoteListResult> {
  const q = cleanStr(options.q, MAX_QUERY);
  const tag = cleanStr(options.tag, MAX_TAG);
  const cursor = cleanStr(options.cursor, 64);
  const limit = cleanLimit(options.limit);

  // Every filter lives INSIDE the userId scope — search can never widen
  // visibility, only narrow the caller's own notes.
  const where = {
    userId,
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { body: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  if (cursor) {
    // The cursor must be one of the caller's own notes. A foreign id and a
    // nonexistent id must be indistinguishable (same 400), or pagination
    // becomes a cross-user existence oracle.
    const anchor = await prisma.gardenNote.findFirst({
      where: { id: cursor, userId },
      select: { id: true },
    });
    if (!anchor) throw new HttpError(400, 'Invalid cursor.');
  }

  const notes = await prisma.gardenNote.findMany({
    where,
    // `id` tiebreaker makes the cursor walk deterministic for same-instant rows.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = notes.slice(0, limit);
  const nextCursor = notes.length > limit ? page[page.length - 1]?.id ?? null : null;
  return { notes: page, nextCursor };
}

export async function createGardenNote(userId: string, input: GardenNoteInput) {
  const body = cleanStr(input.body, MAX_BODY);
  if (!body) throw new HttpError(400, 'A note needs a body.');
  const title = cleanStr(input.title, MAX_TITLE) ?? `${body.slice(0, 48)}${body.length > 48 ? '…' : ''}`;
  const tags = cleanTags(input.tags) ?? [];

  const note = await prisma.gardenNote.create({
    data: { userId, title, body, tags },
  });
  return note;
}

export async function updateGardenNote(userId: string, noteId: string, input: GardenNoteInput) {
  const existing = await prisma.gardenNote.findFirst({ where: { id: noteId, userId } });
  if (!existing) throw new HttpError(404, 'Note not found.');

  const data: Record<string, unknown> = {};
  const title = cleanStr(input.title, MAX_TITLE);
  if (title) data.title = title;
  const body = cleanStr(input.body, MAX_BODY);
  if (body) data.body = body;
  const tags = cleanTags(input.tags);
  if (tags) data.tags = tags;
  if (input.status !== undefined) {
    // 'grown' is only ever set by promotion — a status edit cannot fake it.
    if (input.status !== 'unfiled' && input.status !== 'growing') {
      throw new HttpError(400, "status must be 'unfiled' or 'growing'.");
    }
    if (existing.status === 'grown') {
      throw new HttpError(409, 'A grown note keeps its record; capture a new seed instead.');
    }
    data.status = input.status;
  }
  if (Object.keys(data).length === 0) throw new HttpError(400, 'Nothing to update.');

  // CC-05: content mutations capture the pre-image in the same transaction,
  // so history is complete even if the process dies mid-request. Pure status
  // moves (unfiled ⇄ growing) are workspace state, not content — no revision.
  const contentChanged = data.title !== undefined || data.body !== undefined || data.tags !== undefined;
  if (!contentChanged) {
    return prisma.gardenNote.update({ where: { id: existing.id }, data });
  }
  const [, note] = await prisma.$transaction([
    prisma.gardenNoteRevision.create({
      data: {
        noteId: existing.id,
        userId,
        title: existing.title,
        body: existing.body,
        tags: existing.tags,
        cause: 'update',
      },
    }),
    prisma.gardenNote.update({ where: { id: existing.id }, data }),
  ]);
  return note;
}

export async function deleteGardenNote(userId: string, noteId: string) {
  const existing = await prisma.gardenNote.findFirst({ where: { id: noteId, userId } });
  if (!existing) throw new HttpError(404, 'Note not found.');
  // CC-05: deleting a note hard-deletes its history and its relationships in
  // both directions — revisions, outgoing links, and links pointing at it.
  // All scoped by userId; referenced targets themselves are never touched.
  await prisma.$transaction([
    prisma.gardenNoteRevision.deleteMany({ where: { noteId: existing.id, userId } }),
    prisma.gardenNoteLink.deleteMany({ where: { userId, fromNoteId: existing.id } }),
    prisma.gardenNoteLink.deleteMany({ where: { userId, targetType: 'note', targetId: existing.id } }),
    prisma.gardenNote.delete({ where: { id: existing.id } }),
  ]);
  return { deleted: true as const };
}

export interface PromoteInput {
  section?: unknown;
  headline?: unknown;
  detail?: unknown;
}

/**
 * Explicit promotion: the clinician reviewed the draft and approved it.
 * Transactionally creates the self-attested Living CV line and marks the
 * note grown. The origin line is derived server-side from the real note so
 * a caller cannot write a misleading provenance sentence.
 */
export async function promoteGardenNote(userId: string, noteId: string, input: PromoteInput) {
  const note = await prisma.gardenNote.findFirst({ where: { id: noteId, userId } });
  if (!note) throw new HttpError(404, 'Note not found.');

  const section = typeof input.section === 'string' && (GARDEN_CV_SECTIONS as readonly string[]).includes(input.section)
    ? (input.section as GardenCvSection)
    : undefined;
  if (!section) throw new HttpError(400, `section must be one of: ${GARDEN_CV_SECTIONS.join(', ')}.`);
  const headline = cleanStr(input.headline, MAX_HEADLINE);
  if (!headline) throw new HttpError(400, 'A CV line needs a headline.');
  const detail = cleanStr(input.detail, MAX_DETAIL);
  if (!detail) throw new HttpError(400, 'A CV line needs a detail sentence.');

  const origin = `Grown from your note “${note.title}” (captured ${note.createdAt.toISOString().slice(0, 10)}) — approved by you.`;

  const [entry, updatedNote] = await prisma.$transaction([
    prisma.gardenCvEntry.create({
      data: {
        userId,
        section,
        headline,
        detail,
        provenance: 'self_attested',
        origin,
        fromNoteId: note.id,
      },
    }),
    prisma.gardenNote.update({
      where: { id: note.id },
      data: { status: 'grown', promotedAt: new Date() },
    }),
  ]);
  return { entry, note: updatedNote };
}

export async function listGardenCvEntries(userId: string) {
  return prisma.gardenCvEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/** Reversibility: removing a grown line reopens its seed for another pass. */
export async function deleteGardenCvEntry(userId: string, entryId: string) {
  const existing = await prisma.gardenCvEntry.findFirst({ where: { id: entryId, userId } });
  if (!existing) throw new HttpError(404, 'CV line not found.');

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.gardenCvEntry.delete({ where: { id: existing.id } }),
  ];
  if (existing.fromNoteId) {
    ops.push(
      prisma.gardenNote.updateMany({
        where: { id: existing.fromNoteId, userId },
        data: { status: 'growing', promotedAt: null },
      }),
    );
  }
  await prisma.$transaction(ops);
  return { deleted: true as const, fromNoteId: existing.fromNoteId ?? null };
}
