import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getSsoProviderByOrg } from '../../../../../services/auth/models/SSOProvider';
import { getOidcMetadata } from './oidcClient';
import { persistSsoState } from '../../../services/ssoStateStore';
import { logSsoFailure } from '../../../../../services/audit/ssoEvents';

const router = Router();

const querySchema = z.object({
  orgId: z.string().min(1),
});

router.get('/start', async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
  }

  const { orgId } = parsed.data;

  try {
    const provider = await getSsoProviderByOrg(orgId);
    if (!provider) {
      return res.status(404).json({ error: 'provider_not_found' });
    }

    const metadata = await getOidcMetadata(provider.issuer);
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = crypto.randomBytes(16).toString('hex');

    await persistSsoState(state, {
      providerId: provider.id,
      orgId: provider.orgId,
      nonce,
      createdAt: Date.now(),
    });

    const authorizeUrl = new URL(metadata.authorization_endpoint);
    authorizeUrl.searchParams.set('client_id', provider.clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'openid email profile');
    authorizeUrl.searchParams.set('redirect_uri', provider.redirectUri);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);
    authorizeUrl.searchParams.set('prompt', 'login');

    return res.redirect(authorizeUrl.toString());
  } catch (error: any) {
    await logSsoFailure({
      providerId: 'unknown',
      orgId,
      reason: error?.message || 'start_failure',
      stage: 'start',
    });
    return res.status(500).json({
      error: 'sso_start_failed',
      message: error?.message || 'Unable to start SSO flow',
    });
  }
});

export default router;
