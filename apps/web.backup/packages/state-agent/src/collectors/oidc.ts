/**
 * OIDC configuration collector
 * Collects OIDC/OID4VCI/OID4VP configuration metadata
 */

import * as fs from 'fs';
import * as path from 'path';

const MONOREPO_ROOT = path.resolve(__dirname, '../../../..');

export interface OidcConfigState {
  providers: OidcProvider[];
  totalProviders: number;
  supportedFlows: string[];
  wellKnownEndpoints: string[];
}

export interface OidcProvider {
  name: string;
  type: 'oidc' | 'oid4vci' | 'oid4vp';
  issuer?: string;
  clientId?: string;
  scopes?: string[];
}

export async function collectOidcConfigs(): Promise<OidcConfigState> {
  const providers: OidcProvider[] = [];
  const wellKnownEndpoints: string[] = [];

  // Scan for OIDC-related routes and configs
  const oidcRoutes = [
    path.join(MONOREPO_ROOT, 'apps/api/src/routes/oidc4vci'),
    path.join(MONOREPO_ROOT, 'apps/api/src/routes/oidc4vp'),
    path.join(MONOREPO_ROOT, 'apps/api/src/routes/oid4vci'),
    path.join(MONOREPO_ROOT, 'apps/api/src/routes/wellKnown'),
  ];

  const supportedFlows: string[] = [];

  for (const routeDir of oidcRoutes) {
    if (fs.existsSync(routeDir)) {
      const dirName = path.basename(routeDir);
      if (dirName.includes('oidc4vci') || dirName.includes('oid4vci')) {
        supportedFlows.push('OID4VCI');
        providers.push({
          name: 'OID4VCI Provider',
          type: 'oid4vci',
        });
      }
      if (dirName.includes('oidc4vp') || dirName.includes('oid4vp')) {
        supportedFlows.push('OID4VP');
        providers.push({
          name: 'OID4VP Provider',
          type: 'oid4vp',
        });
      }
      if (dirName.includes('wellKnown')) {
        wellKnownEndpoints.push('/.well-known/openid-configuration');
        wellKnownEndpoints.push('/.well-known/oauth-authorization-server');
      }
    }
  }

  // Check for OIDC utils package
  const oidcUtilsPath = path.join(MONOREPO_ROOT, 'packages/oidc-utils');
  if (fs.existsSync(oidcUtilsPath)) {
    providers.push({
      name: 'OIDC Utils',
      type: 'oidc',
    });
    supportedFlows.push('OIDC');
  }

  return {
    providers: [...new Map(providers.map(p => [p.name, p])).values()],
    totalProviders: providers.length,
    supportedFlows: [...new Set(supportedFlows)],
    wellKnownEndpoints: [...new Set(wellKnownEndpoints)],
  };
}

