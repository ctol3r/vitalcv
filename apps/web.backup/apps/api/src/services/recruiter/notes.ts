import { PrismaClient, type RecruiterNote } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateRecruiterNoteInput {
  clinicianId: string;
  recruiterId: string;
  note: string;
}

export interface UpdateRecruiterNoteInput {
  note: string;
}

export async function listRecruiterNotes(clinicianId: string): Promise<RecruiterNote[]> {
  if (!clinicianId) {
    throw new Error('clinicianId is required to list recruiter notes');
  }

  return prisma.recruiterNote.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createRecruiterNote(
  input: CreateRecruiterNoteInput,
): Promise<RecruiterNote> {
  if (!input.clinicianId) throw new Error('clinicianId is required');
  if (!input.recruiterId) throw new Error('recruiterId is required');
  if (!input.note?.trim()) throw new Error('note content is required');

  return prisma.recruiterNote.create({
    data: {
      clinicianId: input.clinicianId,
      recruiterId: input.recruiterId,
      note: input.note.trim(),
    },
  });
}

export async function updateRecruiterNote(
  noteId: string,
  input: UpdateRecruiterNoteInput,
): Promise<RecruiterNote> {
  if (!noteId) throw new Error('noteId is required');
  if (!input.note?.trim()) throw new Error('note content is required');

  return prisma.recruiterNote.update({
    where: { id: noteId },
    data: { note: input.note.trim() },
  });
}

export async function deleteRecruiterNote(noteId: string): Promise<void> {
  if (!noteId) throw new Error('noteId is required');
  await prisma.recruiterNote.delete({ where: { id: noteId } });
}










