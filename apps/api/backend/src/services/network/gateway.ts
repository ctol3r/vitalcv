/**
 * gateway.ts — Wave 91: Trust Network Gateway
 *
 * Generates gateway tokens for external organizations
 * connecting to the VitalCV trust network.
 */

import { randomUUID } from 'node:crypto';
import { sha256Hex } from '../../utils/deterministic';
import { log } from '../../obs/logger';
import { gatewayRegistry, type ConnectedOrganization } from './gatewayRegistry';

// ── Types ─────────────────────────────────────────────────────────────

export type GatewayPermission =
  | 'credential:read'
  | 'credential:verify'
  | 'decision:read'
  | 'trust_state:read'
  | 'webhook:subscribe';

export interface GatewayToken {
  apiKey: string;
  organization: {
    id: string;
    name: string;
    type: string;
  };
  permissions: GatewayPermission[];
  issuedAt: string;
  expiresAt: string;
}

// ── Core Generator ────────────────────────────────────────────────────

export function generateGatewayToken(
  organizationId: string,
  organizationName: string = organizationId,
  orgType: string = 'hospital',
): GatewayToken {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const apiKey = `vitalcv_gw_${sha256Hex(`${organizationId}:${randomUUID()}:${now.toISOString()}`).slice(0, 40)}`;

  const permissions: GatewayPermission[] = [
    'credential:read',
    'credential:verify',
    'decision:read',
    'trust_state:read',
    'webhook:subscribe',
  ];

  // Register in the gateway registry
  const org: ConnectedOrganization = {
    id: organizationId,
    name: organizationName,
    type: orgType,
    apiKey,
    permissions,
    connectedAt: now.toISOString(),
    lastActivity: now.toISOString(),
    status: 'ACTIVE',
  };
  gatewayRegistry.register(org);

  log('info', 'gateway: token generated', { organizationId, permissions: permissions.length });

  return {
    apiKey,
    organization: { id: organizationId, name: organizationName, type: orgType },
    permissions,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}
