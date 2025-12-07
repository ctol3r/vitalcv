import { Router, type Request, type Response } from 'express';
import {
  createRecruiterNote,
  deleteRecruiterNote,
  listRecruiterNotes,
  updateRecruiterNote,
} from '../../services/recruiter/notes';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const notes = await listRecruiterNotes(req.params.clinicianId);
    return res.json({ clinicianId: req.params.clinicianId, notes });
  } catch (error) {
    console.error('[Recruiter][notes] list failed', error);
    return res.status(400).json({
      error: 'recruiter_notes_list_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const note = await createRecruiterNote({
      clinicianId: req.params.clinicianId,
      recruiterId: resolveRecruiterId(req),
      note: req.body?.note ?? '',
    });
    return res.status(201).json(note);
  } catch (error) {
    console.error('[Recruiter][notes] create failed', error);
    return res.status(400).json({
      error: 'recruiter_note_create_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.put('/:clinicianId/:noteId', async (req: Request, res: Response) => {
  try {
    const updated = await updateRecruiterNote(req.params.noteId, {
      note: req.body?.note ?? '',
    });
    return res.json(updated);
  } catch (error) {
    console.error('[Recruiter][notes] update failed', error);
    return res.status(400).json({
      error: 'recruiter_note_update_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.delete('/:clinicianId/:noteId', async (req: Request, res: Response) => {
  try {
    await deleteRecruiterNote(req.params.noteId);
    return res.status(204).send();
  } catch (error) {
    console.error('[Recruiter][notes] delete failed', error);
    return res.status(400).json({
      error: 'recruiter_note_delete_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function resolveRecruiterId(req: Request): string {
  const fromHeader = req.header('x-recruiter-id');
  if (fromHeader) return fromHeader;
  const fromBody = typeof req.body?.recruiterId === 'string' ? req.body.recruiterId : undefined;
  return fromBody ?? 'demo-recruiter';
}

export default router;










