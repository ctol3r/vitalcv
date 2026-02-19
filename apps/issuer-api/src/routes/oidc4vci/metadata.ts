import { Request, Response, Router } from 'express';
import { buildOpenidCredentialIssuerMetadata } from '../../services/issuerMetadata';

const router: Router = Router();

router.get('/.well-known/openid-credential-issuer', (_req: Request, res: Response): void => {
  const payload = buildOpenidCredentialIssuerMetadata();
  res.json(payload);
});

export default router;
