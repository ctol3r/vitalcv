import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OrgMembershipRole } from '@prisma/client';
import { getSsoProviderById, getSsoClientSecret } from '../../../../../services/auth/models/SSOProvider';
import { consumeSsoState } from '../../../services/ssoStateStore';
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  getOidcMetadata,
  verifyIdToken,
} from './oidcClient';
import { provisionSsoUser } from '../../../../../services/auth/ssoProvision';
import { linkDidFromSso } from '../../../../../services/auth/ssoDidLink';
import { logSsoFailure, logSsoSuccess } from '../../../../../services/audit/ssoEvents';
import { generateToken } from '../../../../../backend/src/auth/jwt';

const router = Router();

const callbackSchema = z.object({
  state: z.string().min(8),
  code: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

function extractIp(req: Request): string {
  const forwarded = (req.headers['x-forwarded-for'] as string) || '';
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) {
    return realIp;
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

function mapMembershipRoleToUserRole(role: OrgMembershipRole): 'user' | 'clinician' {
  return role === OrgMembershipRole.ADMIN ? 'user' : 'clinician';
}

router.get('/callback', async (req: Request, res: Response) => {
  const parsed = callbackSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
  }

  const { state, code, error, error_description } = parsed.data;
  if (error) {
    await logSsoFailure({
      providerId: 'unknown',
      orgId: 'unknown',
      reason: `${error}:${error_description || ''}`.trim(),
      stage: 'callback',
    });
    return res.status(400).json({ error, error_description });
  }

  if (!code) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing authorization code' });
  }

  const stateRecord = await consumeSsoState(state);
  if (!stateRecord) {
    await logSsoFailure({
      providerId: 'unknown',
      orgId: 'unknown',
      reason: 'state_not_found',
      stage: 'callback',
    });
    return res.status(400).json({ error: 'invalid_state' });
  }

  const provider = await getSsoProviderById(stateRecord.providerId);
  if (!provider) {
    await logSsoFailure({
      providerId: stateRecord.providerId,
      orgId: stateRecord.orgId,
      reason: 'provider_not_found',
      stage: 'callback',
    });
    return res.status(404).json({ error: 'provider_not_found' });
  }

  const ip = extractIp(req);

  try {
    const metadata = await getOidcMetadata(provider.issuer);
    const clientSecret = await getSsoClientSecret(provider);
    const tokens = await exchangeCodeForTokens({
      code,
      clientId: provider.clientId,
      clientSecret,
      redirectUri: provider.redirectUri,
      tokenEndpoint: metadata.token_endpoint,
    });

    const idPayload = await verifyIdToken({
      idToken: tokens.id_token,
      issuer: metadata.issuer || provider.issuer,
      audience: provider.clientId,
      jwksUri: metadata.jwks_uri,
      nonce: stateRecord.nonce,
    });

    let userInfo: Record<string, unknown> = {};
    if (metadata.userinfo_endpoint) {
      try {
        userInfo = await fetchUserInfo(metadata.userinfo_endpoint, tokens.access_token);
      } catch (userinfoError) {
        console.warn('[sso] userinfo fetch failed', userinfoError);
      }
    }

    const email = (userInfo.email as string) || (idPayload.email as string);
    if (!email) {
      throw new Error('SSO profile missing email');
    }

    if (
      provider.domainWhitelist.length > 0 &&
      !provider.domainWhitelist.includes(emailDomain(email))
    ) {
      await logSsoFailure({
        providerId: provider.id,
        orgId: provider.orgId,
        email,
        ip,
        reason: 'domain_not_allowed',
        stage: 'callback',
      });
      return res.status(403).json({ error: 'domain_not_allowed' });
    }

    const profileName =
      (userInfo.name as string) ||
      [userInfo.given_name, userInfo.family_name].filter(Boolean).join(' ') ||
      (idPayload.name as string) ||
      undefined;

    const provisionResult = await provisionSsoUser({
      orgId: provider.orgId,
      providerId: provider.id,
      role: provider.autoProvisionRole,
      profile: {
        email,
        name: profileName,
      },
    });

    await linkDidFromSso(provisionResult.user.id, {
      idToken: idPayload as Record<string, unknown>,
      userInfo,
    });

    const token = generateToken({
      userId: provisionResult.user.id,
      role: mapMembershipRoleToUserRole(provider.autoProvisionRole),
    });

    await logSsoSuccess({
      providerId: provider.id,
      orgId: provider.orgId,
      userId: provisionResult.user.id,
      email,
      ip,
      nonce: stateRecord.nonce,
      state,
    });

    return res.json({
      token,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: provisionResult.user.id,
        email: provisionResult.user.email,
        name: provisionResult.user.name,
        roles: provisionResult.user.roles,
      },
      orgMembership: {
        orgId: provisionResult.membership.orgId,
        role: provisionResult.membership.role,
      },
      provider: {
        id: provider.id,
        orgId: provider.orgId,
      },
    });
  } catch (err: any) {
    await logSsoFailure({
      providerId: provider.id,
      orgId: provider.orgId,
      email: undefined,
      ip,
      reason: err?.message || 'callback_failure',
      stage: 'callback',
    });
    return res.status(500).json({
      error: 'sso_callback_failed',
      message: err?.message || 'Unable to complete SSO login',
    });
  }
});

export default router;
