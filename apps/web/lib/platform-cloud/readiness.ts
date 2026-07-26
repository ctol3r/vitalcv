/**
 * Professional Trust Cloud — enterprise deployment readiness (Wave 900, C7)
 * ──────────────────────────────────────────────────────────────────────────
 * A fail-closed readiness check for multi-tenant deployment. It reports, per
 * tenant, whether the configuration required to operate securely is present —
 * without ever inventing a default secret. A tenant with no configured signing
 * secret is reported NOT ready (it must not sign/verify with a guessable key).
 */
import type { PlatformRegistry } from './registry';

export interface TenantReadiness {
  tenantId: string;
  ready: boolean;
  /** Human-readable blockers (empty when ready). */
  blockers: string[];
}

export interface PlatformReadiness {
  cloudId: string;
  ready: boolean;
  tenants: TenantReadiness[];
  /** True only in production posture (stricter requirements). */
  production: boolean;
}

/**
 * Resolve readiness. `secretFor` returns a configured signing secret for a
 * tenant (e.g. from env), or undefined if unset — injected so this stays pure
 * and testable. In production an unset secret is a hard blocker; outside
 * production it is a warning-level blocker but still reported.
 */
export function platformReadiness(
  registry: PlatformRegistry,
  secretFor: (tenantId: string) => string | undefined,
  production: boolean,
): PlatformReadiness {
  const tenants: TenantReadiness[] = registry.tenants.map((t) => {
    const blockers: string[] = [];

    const secret = secretFor(t.tenantId);
    if (!secret || secret.trim().length === 0) {
      blockers.push(`No signing secret configured for tenant "${t.tenantId}".`);
    }
    if (t.federation.members.length === 0) {
      blockers.push(`Tenant "${t.tenantId}" federation has no members.`);
    }

    return { tenantId: t.tenantId, ready: blockers.length === 0, blockers };
  });

  // Fail closed: the cloud is ready only if every tenant is ready. In production
  // this is enforced; outside production we still report it honestly.
  const ready = tenants.every((t) => t.ready);
  return { cloudId: registry.cloudId, ready, tenants, production };
}
