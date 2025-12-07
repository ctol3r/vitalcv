import { Router, type Request, type Response } from 'express';

const router = Router();

router.get('/.well-known/smart-configuration', (req: Request, res: Response) => {
  const issuer =
    process.env.SMART_ISSUER_URL ??
    `${req.protocol}://${req.get('host') ?? 'localhost:4000'}`;
  const redirectUris =
    process.env.SMART_REDIRECT_URIS?.split(',').map((uri) => uri.trim()).filter(Boolean) ??
    [`${process.env.PUBLIC_WEB_URL ?? 'https://app.vitalcv.health'}/ehr/launch`];

  const payload = {
    issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    scopes_supported: ['launch', 'patient/*.read', 'openid', 'profile'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    response_types_supported: ['code'],
    capabilities: ['launch-ehr', 'context-standalone-patient', 'permission-v1'],
    redirect_uris: redirectUris,
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'private_key_jwt'],
  };

  return res.json(payload);
});

export default router;











