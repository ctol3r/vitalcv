/**
 * gatewayRegistry.ts — Wave 91: Gateway Registry
 *
 * In-memory store for connected organizations,
 * their permissions, and activity tracking.
 */

import type { GatewayPermission } from './gateway';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export interface ConnectedOrganization {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  permissions: GatewayPermission[];
  connectedAt: string;
  lastActivity: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
}

// ── Registry ──────────────────────────────────────────────────────────

class GatewayRegistry {
  private organizations = new Map<string, ConnectedOrganization>();

  register(org: ConnectedOrganization): void {
    this.organizations.set(org.id, org);
    log('info', 'gateway_registry: registered', { orgId: org.id, name: org.name });
  }

  get(id: string): ConnectedOrganization | undefined {
    return this.organizations.get(id);
  }

  getByApiKey(apiKey: string): ConnectedOrganization | undefined {
    for (const org of this.organizations.values()) {
      if (org.apiKey === apiKey) return org;
    }
    return undefined;
  }

  recordActivity(id: string): void {
    const org = this.organizations.get(id);
    if (org) {
      org.lastActivity = new Date().toISOString();
    }
  }

  listAll(): ConnectedOrganization[] {
    return Array.from(this.organizations.values());
  }

  count(): number {
    return this.organizations.size;
  }
}

export const gatewayRegistry = new GatewayRegistry();
