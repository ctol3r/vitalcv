import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';
import { HttpError } from '../../utils/httpError';

/**
 * WB-11 — consent-gated agent visibility for Workbench notes.
 *
 * The D1 decision (2026-08-09): the default exclusion of notes from agent
 * inputs HOLDS. A note becomes agent-readable only by the clinician's
 * explicit, per-note, revocable opt-in, recorded as a timestamp
 * (`agentConsentAt`; NULL = excluded).
 *
 * `listAgentReadableNotes` is THE ONLY accessor any agent pipeline may use.
 * It re-queries consent on every call (revocation is effective on the next
 * read — there is no cache to purge) and writes its own AuditEvent BEFORE
 * returning, so no future caller can consume notes unaudited. The audit row
 * carries ids and counts, never note text.
 *
 * Invariant 10 (knowledge program): opt-in is not disclosure. This module
 * changes what the user's OWN agent may read. It never widens employer
 * surfaces, matching, ranking, eligibility, dossiers, or analytics — none
 * of which read these tables, and the data-policy tests pin that.
 */

export async function setNoteAgentConsent(userId: string, noteId: string, enabled: boolean) {
  const existing = await prisma.gardenNote.findFirst({ where: { id: noteId, userId } });
  if (!existing) throw new HttpError(404, 'Note not found.');

  return prisma.gardenNote.update({
    where: { id: existing.id },
    data: { agentConsentAt: enabled ? new Date() : null },
  });
}

/**
 * The single agent-facing read. Only rows the caller's user explicitly
 * opted in; consent re-checked at query time; audited before return.
 */
export async function listAgentReadableNotes(userId: string) {
  const notes = await prisma.gardenNote.findMany({
    where: { userId, agentConsentAt: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  // Audit BEFORE the caller sees anything — ids and count only, never text.
  const metadata = { noteIds: notes.map((n) => n.id), count: notes.length };
  await prisma.auditEvent.create({
    data: {
      type: 'garden_agent_notes_read',
      hash: sha256ForPayload({ type: 'garden_agent_notes_read', referenceId: userId, metadata }),
      referenceId: userId,
      metadata,
    },
  });

  return notes;
}
