import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';

/**
 * Career Garden typed links and revisions — CC-05 / WB-02.
 *
 * Truth contract (extends gardenService.ts):
 *  - Every query filters on the internal userId resolved from the verified
 *    identity. Cross-user access reads as not-found, never forbidden.
 *  - Target types are a CLOSED allowlist. Ownership/visibility of a target
 *    is resolved server-side at create time AND again at read time, so a
 *    link can never disclose a row its owner could not read directly.
 *  - `label` is derived server-side from the resolved target. Caller-supplied
 *    labels are ignored — a link cannot carry a misleading display string.
 *  - A link is a research pointer, never evidence. Nothing in this module
 *    reads or writes provenance, source state, or trust state.
 *  - Revisions are immutable pre-images. Restore is the only mutation that
 *    reads them, it re-captures the current content first, and it is audited
 *    in the route layer before the 2xx.
 */

export const LINK_TARGET_TYPES = [
  'note',
  'cv_entry',
  'opportunity',
  'profile_field',
  'source_pointer',
] as const;
export type LinkTargetType = (typeof LINK_TARGET_TYPES)[number];

/**
 * Closed registry of profile-field link targets. Keys, not free text: a
 * profile-field link points at a section of the clinician's own profile, so
 * there is no row-level ownership to check — the key either exists here or
 * the link is refused.
 */
export const PROFILE_FIELD_KEYS: Record<string, string> = {
  preferred_location: 'Profile: Preferred location',
  schedule_preference: 'Profile: Schedule preference',
  specialty_focus: 'Profile: Specialty focus',
  licensure_plan: 'Profile: Licensure plan',
  compensation_floor: 'Profile: Compensation floor',
};

/**
 * Closed registry of source pointers. A pointer is a research bookmark
 * ("I was reading my NPPES record when I wrote this") — it is NEVER a
 * verification claim, and creating one performs no fetch and no check.
 */
export const SOURCE_POINTER_KEYS: Record<string, string> = {
  nppes: 'Source: NPPES record (research pointer)',
  oig_leie: 'Source: OIG LEIE check (research pointer)',
  pecos: 'Source: PECOS enrollment (research pointer)',
  state_board: 'Source: State licensing board (research pointer)',
};

const MAX_LINKS_PER_NOTE = 100;
const GRAPH_NODE_CAP = 60;

interface ResolvedTarget {
  label: string;
}

async function requireOwnedNote(userId: string, noteId: string) {
  const note = await prisma.gardenNote.findFirst({ where: { id: noteId, userId } });
  if (!note) throw new HttpError(404, 'Note not found.');
  return note;
}

/**
 * Resolve a link target within the caller's legal visibility. Returns null
 * when the target does not exist OR is not theirs to see — indistinguishable
 * by design (no existence leak).
 */
export async function resolveTarget(
  userId: string,
  targetType: string,
  targetId: string,
): Promise<ResolvedTarget | null> {
  switch (targetType as LinkTargetType) {
    case 'note': {
      const note = await prisma.gardenNote.findFirst({ where: { id: targetId, userId } });
      return note ? { label: note.title } : null;
    }
    case 'cv_entry': {
      const entry = await prisma.gardenCvEntry.findFirst({ where: { id: targetId, userId } });
      return entry ? { label: entry.headline } : null;
    }
    case 'opportunity': {
      // Public-board visibility: a clinician may reference any posting the
      // public board would show them. Organization-internal state is never
      // exposed — only id, title, and location-ish display fields are read.
      const opp = await prisma.opportunity.findFirst({
        where: { id: targetId, status: 'ACTIVE' },
        select: { title: true, specialty: true, state: true },
      });
      return opp ? { label: `Role: ${opp.title} — ${opp.specialty}, ${opp.state}` } : null;
    }
    case 'profile_field': {
      const label = PROFILE_FIELD_KEYS[targetId];
      return label ? { label } : null;
    }
    case 'source_pointer': {
      const label = SOURCE_POINTER_KEYS[targetId];
      return label ? { label } : null;
    }
    default:
      return null;
  }
}

export interface CreateLinkInput {
  targetType?: unknown;
  targetId?: unknown;
}

export async function createNoteLink(userId: string, fromNoteId: string, input: CreateLinkInput) {
  await requireOwnedNote(userId, fromNoteId);

  const targetType = typeof input.targetType === 'string' ? input.targetType : '';
  if (!(LINK_TARGET_TYPES as readonly string[]).includes(targetType)) {
    throw new HttpError(400, `targetType must be one of: ${LINK_TARGET_TYPES.join(', ')}.`);
  }
  const targetId = typeof input.targetId === 'string' ? input.targetId.trim() : '';
  if (!targetId) throw new HttpError(400, 'A link needs a targetId.');
  if (targetType === 'note' && targetId === fromNoteId) {
    throw new HttpError(400, 'A note cannot link to itself.');
  }

  const resolved = await resolveTarget(userId, targetType, targetId);
  if (!resolved) throw new HttpError(404, 'Link target not found.');

  const existingCount = await prisma.gardenNoteLink.count({ where: { userId, fromNoteId } });
  if (existingCount >= MAX_LINKS_PER_NOTE) {
    throw new HttpError(409, `A note holds at most ${MAX_LINKS_PER_NOTE} links.`);
  }

  const duplicate = await prisma.gardenNoteLink.findFirst({
    where: { userId, fromNoteId, targetType, targetId },
  });
  if (duplicate) throw new HttpError(409, 'This link already exists.');

  // Label is derived from the resolved target — caller input never reaches it.
  return prisma.gardenNoteLink.create({
    data: { userId, fromNoteId, targetType, targetId, label: resolved.label },
  });
}

/**
 * Outgoing links for an owned note. Each link is re-resolved at read time:
 * a target that has since become invisible (deleted note, expired role)
 * reports `resolved: false` with its stored label snapshot — it never leaks
 * the current row.
 */
export async function listNoteLinks(userId: string, noteId: string) {
  await requireOwnedNote(userId, noteId);
  const links = await prisma.gardenNoteLink.findMany({
    where: { userId, fromNoteId: noteId },
    orderBy: { createdAt: 'asc' },
  });
  return Promise.all(
    links.map(async (link) => ({
      ...link,
      resolved: (await resolveTarget(userId, link.targetType, link.targetId)) !== null,
    })),
  );
}

/** Backlinks: the caller's own notes that point at this owned note. */
export async function listNoteBacklinks(userId: string, noteId: string) {
  await requireOwnedNote(userId, noteId);
  const links = await prisma.gardenNoteLink.findMany({
    where: { userId, targetType: 'note', targetId: noteId },
    orderBy: { createdAt: 'asc' },
  });
  const fromIds = [...new Set(links.map((l) => l.fromNoteId))];
  const fromNotes = fromIds.length
    ? await prisma.gardenNote.findMany({
        where: { id: { in: fromIds }, userId },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(fromNotes.map((n) => [n.id, n.title]));
  // A link whose from-note no longer resolves within the owner scope is
  // dropped, not surfaced — backlinks never disclose an inaccessible title.
  return links
    .filter((l) => titleById.has(l.fromNoteId))
    .map((l) => ({ id: l.id, fromNoteId: l.fromNoteId, fromTitle: titleById.get(l.fromNoteId)!, createdAt: l.createdAt }));
}

/** Deleting a link removes only the relationship — never the referenced data. */
export async function deleteNoteLink(userId: string, linkId: string) {
  const existing = await prisma.gardenNoteLink.findFirst({ where: { id: linkId, userId } });
  if (!existing) throw new HttpError(404, 'Link not found.');
  await prisma.gardenNoteLink.delete({ where: { id: existing.id } });
  return { deleted: true as const };
}

/**
 * Focused neighborhood for a selected owned note: the note, its outgoing
 * link targets, and its backlinking notes — one hop, capped, owner-scoped
 * at the query level. This is the traversal primitive WB-07's Connections
 * Map renders; it exists here so the authorization contract and its tests
 * precede any graph UI.
 */
export async function noteNeighborhood(userId: string, noteId: string) {
  const center = await requireOwnedNote(userId, noteId);
  const [outgoing, incoming] = await Promise.all([
    prisma.gardenNoteLink.findMany({
      where: { userId, fromNoteId: noteId },
      orderBy: { createdAt: 'asc' },
      take: GRAPH_NODE_CAP,
    }),
    prisma.gardenNoteLink.findMany({
      where: { userId, targetType: 'note', targetId: noteId },
      orderBy: { createdAt: 'asc' },
      take: GRAPH_NODE_CAP,
    }),
  ]);

  const nodes: Array<{ id: string; type: string; label: string }> = [
    { id: `note:${center.id}`, type: 'note', label: center.title },
  ];
  const edges: Array<{ from: string; to: string }> = [];

  for (const link of outgoing) {
    if (nodes.length >= GRAPH_NODE_CAP) break;
    const resolved = await resolveTarget(userId, link.targetType, link.targetId);
    if (!resolved) continue; // invisible targets never enter the graph
    const nodeId = `${link.targetType}:${link.targetId}`;
    if (!nodes.some((n) => n.id === nodeId)) {
      nodes.push({ id: nodeId, type: link.targetType, label: resolved.label });
    }
    edges.push({ from: `note:${center.id}`, to: nodeId });
  }

  if (incoming.length) {
    const fromNotes = await prisma.gardenNote.findMany({
      where: { id: { in: incoming.map((l) => l.fromNoteId) }, userId },
      select: { id: true, title: true },
    });
    for (const n of fromNotes) {
      if (nodes.length >= GRAPH_NODE_CAP) break;
      const nodeId = `note:${n.id}`;
      if (!nodes.some((node) => node.id === nodeId)) {
        nodes.push({ id: nodeId, type: 'note', label: n.title });
      }
      edges.push({ from: nodeId, to: `note:${center.id}` });
    }
  }

  return { nodes, edges, cap: GRAPH_NODE_CAP };
}

/** Immutable revision history for an owned note, newest first. */
export async function listNoteRevisions(userId: string, noteId: string) {
  await requireOwnedNote(userId, noteId);
  return prisma.gardenNoteRevision.findMany({
    where: { userId, noteId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Restore an owned note to one of its own revisions. The current content is
 * captured first (cause 'pre_restore') in the same transaction, so restore
 * never destroys history. A grown note keeps its record — same 409 rule as
 * editing.
 */
export async function restoreNoteRevision(userId: string, noteId: string, revisionId: string) {
  const note = await requireOwnedNote(userId, noteId);
  if (note.status === 'grown') {
    throw new HttpError(409, 'A grown note keeps its record; capture a new seed instead.');
  }
  const revision = await prisma.gardenNoteRevision.findFirst({
    where: { id: revisionId, noteId, userId },
  });
  if (!revision) throw new HttpError(404, 'Revision not found.');

  const [, restored] = await prisma.$transaction([
    prisma.gardenNoteRevision.create({
      data: {
        noteId: note.id,
        userId,
        title: note.title,
        body: note.body,
        tags: note.tags,
        cause: 'pre_restore',
      },
    }),
    prisma.gardenNote.update({
      where: { id: note.id },
      data: { title: revision.title, body: revision.body, tags: revision.tags },
    }),
  ]);
  return { note: restored, restoredFrom: revision.id };
}
