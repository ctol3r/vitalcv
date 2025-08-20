import { Router } from 'express';
import { getCredentialStatus } from '../controllers/verifier_controller';

export const router = Router();

router.get('/verifier/credential/:credentialId/status', async (req, res) => {
  try {
    const status = await getCredentialStatus(req.params.credentialId);
    res.json({ credentialId: req.params.credentialId, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch credential status' });
  }
});
