import { Request, Response, Router } from 'express';
import { getIssuerDidDocument } from '../services/vcIssuer';

const router: Router = Router();

router.get('/.well-known/did.json', async (_req: Request, res: Response): Promise<void> => {
  try {
    const document = getIssuerDidDocument();
    res.status(200).json(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to resolve issuer DID document.';
    res.status(500).json({ error: message });
  }
});

export default router;
