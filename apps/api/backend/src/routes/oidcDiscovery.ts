import type { Express, NextFunction, Request, Response } from 'express';
import { getFeatureFlag } from '../config/envValidation';
import { getJwks } from '../services/sd-jwt/keyManager';
import {
  buildAuthorizationServerMetadata,
  buildCredentialIssuerMetadata,
  getOid4vcIssuerBaseUrl,
} from '../services/oid4vc/metadataService';
import { log } from '../obs/logger';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function oid4vcFeatureEnabled(): boolean {
  return getFeatureFlag('FEATURE_OID4VC');
}

function denyIfDisabled(res: Response): boolean {
  if (oid4vcFeatureEnabled()) {
    return false;
  }

  res.status(404).json({ error: 'OID4VC discovery is disabled' });
  return true;
}

export function registerOidcDiscoveryRoutes(app: Express): void {
  app.get('/.well-known/openid-credential-issuer', (_req: Request, res: Response) => {
    if (denyIfDisabled(res)) {
      return;
    }

    try {
      res.json(buildCredentialIssuerMetadata(getOid4vcIssuerBaseUrl()));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'oidc_discovery_credential_issuer_error', { error: message });
      res.status(500).json({ error: message });
    }
  });

  app.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
    if (denyIfDisabled(res)) {
      return;
    }

    try {
      res.json(buildAuthorizationServerMetadata(getOid4vcIssuerBaseUrl()));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'oidc_discovery_openid_configuration_error', { error: message });
      res.status(500).json({ error: message });
    }
  });

  app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    if (denyIfDisabled(res)) {
      return;
    }

    try {
      res.json(buildAuthorizationServerMetadata(getOid4vcIssuerBaseUrl()));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'oidc_discovery_oauth_authorization_server_error', { error: message });
      res.status(500).json({ error: message });
    }
  });

  app.get(
    '/api/.well-known/jwks.json',
    asyncHandler(async (_req: Request, res: Response) => {
      const jwks = await getJwks();
      res.json(jwks);
    }),
  );
}
