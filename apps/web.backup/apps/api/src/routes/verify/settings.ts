import { Router, type Request, type Response } from 'express';

import { getVerifierSettings, setProofRequired } from '../../services/verification/settings';

const router = Router();

router.get('/verify/settings', (_req: Request, res: Response) => {
  const settings = getVerifierSettings();
  return res.json(settings);
});

router.patch('/verify/settings', (req: Request, res: Response) => {
  const { proofRequired } = req.body ?? {};
  if (typeof proofRequired !== 'boolean') {
    return res.status(400).json({
      error: 'bad_request',
      message: 'proofRequired boolean is required',
    });
  }

  const settings = setProofRequired(proofRequired);
  return res.json(settings);
});

export default router;










