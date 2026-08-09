import prisma from '../../graphql/prisma_client';

/**
 * WB-10 — privacy-safe export of the caller's entire Workbench.
 *
 * Everything the note domain holds about ONE user, in one versioned JSON
 * document: notes, revisions, typed links, and Living CV lines. Every query
 * is scoped by the resolved internal userId — the export can structurally
 * contain no other user's rows. The route layer audits the export (counts
 * only) before the 2xx.
 *
 * The format is versioned so a future importer / account-closure flow can
 * rely on it. The account-closure walkthrough itself is UI and lands
 * post-UX-03.
 */

export const WORKBENCH_EXPORT_FORMAT = 'vitalcv-workbench-export/v1' as const;

export async function exportWorkbench(userId: string) {
  const [notes, revisions, links, cvEntries] = await prisma.$transaction([
    prisma.gardenNote.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.gardenNoteRevision.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.gardenNoteLink.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.gardenCvEntry.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    format: WORKBENCH_EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    counts: {
      notes: notes.length,
      revisions: revisions.length,
      links: links.length,
      cvEntries: cvEntries.length,
    },
    notes,
    revisions,
    links,
    cvEntries,
  };
}
