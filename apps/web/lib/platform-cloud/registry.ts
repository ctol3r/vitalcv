/**
 * Professional Trust Cloud — platform federation & identity (Wave 900, C1/C2)
 * ──────────────────────────────────────────────────────────────────────────
 * One cloud hosting MANY federations (tenants) — products and organizations —
 * over the shared trust infrastructure. This extends the per-federation model
 * (lib/exchange/federation.ts) up one level into a multi-tenant registry. It
 * holds no trust data: it answers "which tenants/orgs exist" and "which tenants
 * reference this provider", never "how trustworthy is this provider" — trust is
 * always re-derived from evidence by the consuming product.
 */
import type { FederationRegistry } from '@/lib/exchange/federation';
import { isFederationMember } from '@/lib/exchange/federation';

export interface PlatformTenant {
  tenantId: string;
  name: string;
  /** The product/organization kind this tenant represents. */
  kind: 'product' | 'organization';
  /** This tenant's federation (members + roles). */
  federation: FederationRegistry;
}

export interface PlatformRegistry {
  cloudId: string;
  tenants: PlatformTenant[];
}

export function findTenant(registry: PlatformRegistry, tenantId: string): PlatformTenant | null {
  const id = tenantId?.trim();
  if (!id) return null;
  return registry.tenants.find((t) => t.tenantId === id) ?? null;
}

/**
 * C2: cross-organization identity. A provider is identified by one stable
 * subjectKey across the whole cloud; this resolves WHICH tenants/orgs reference
 * that identity (by org membership), without copying any provider data between
 * tenants. Returns an honest, evidence-free index — presence, not trust.
 */
export interface CloudIdentityResolution {
  subjectKey: string;
  /** Tenants whose federation includes the given org key(s) for this provider. */
  tenants: { tenantId: string; name: string; kind: PlatformTenant['kind'] }[];
}

export function resolveCloudIdentity(
  registry: PlatformRegistry,
  subjectKey: string,
  affiliatedOrgKeys: string[],
): CloudIdentityResolution {
  const orgs = new Set(affiliatedOrgKeys.map((k) => k.trim()).filter(Boolean));
  const tenants = registry.tenants
    .filter((t) => [...orgs].some((org) => isFederationMember(t.federation, org)))
    .map((t) => ({ tenantId: t.tenantId, name: t.name, kind: t.kind }));
  return { subjectKey, tenants };
}

/** The demo cloud: one product tenant + one staffing-org tenant. */
export function demoPlatformRegistry(): PlatformRegistry {
  return {
    cloudId: 'vitalcv-trust-cloud',
    tenants: [
      {
        tenantId: 'vitalcv-careers',
        name: 'VitalCV Careers',
        kind: 'product',
        federation: {
          federationId: 'vitalcv-careers-fed',
          members: [{ orgKey: 'org-vitalcv-network', name: 'VitalCV Network', roles: ['issuer', 'verifier'] }],
        },
      },
      {
        tenantId: 'coastal-staffing',
        name: 'Coastal Staffing Network',
        kind: 'organization',
        federation: {
          federationId: 'coastal-fed',
          members: [
            { orgKey: 'org-mercy-health', name: 'Mercy Health System', roles: ['issuer'] },
            { orgKey: 'org-coastal-staffing', name: 'Coastal Staffing Network', roles: ['verifier'] },
          ],
        },
      },
    ],
  };
}
