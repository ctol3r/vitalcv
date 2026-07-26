/**
 * Professional Trust Cloud — application registry & partner authz (Wave 900, C3/C4)
 * ──────────────────────────────────────────────────────────────────────────
 * The registry of partner applications permitted to call the platform, each
 * with explicit scopes. Authorization is least-privilege and fails closed: an
 * unknown app, or an app lacking the required scope, is refused. This is the
 * gate in front of the Partner APIs (C4) — it governs ACCESS, never trust.
 */

/** Coarse-grained, read-oriented scopes. No scope grants write to source data. */
export type PlatformScope =
  | 'identity:read'
  | 'evidence:read'
  | 'trust:read'
  | 'reasoning:read'
  | 'events:subscribe';

export const PLATFORM_SCOPES: readonly PlatformScope[] = [
  'identity:read',
  'evidence:read',
  'trust:read',
  'reasoning:read',
  'events:subscribe',
] as const;

export interface Application {
  appId: string;
  name: string;
  /** Granted scopes (subset of PLATFORM_SCOPES). */
  scopes: PlatformScope[];
  /** Tenants this app may operate within (empty ⇒ none). */
  tenantIds: string[];
}

export interface ApplicationRegistry {
  applications: Application[];
}

export function findApplication(registry: ApplicationRegistry, appId: string): Application | null {
  const id = appId?.trim();
  if (!id) return null;
  return registry.applications.find((a) => a.appId === id) ?? null;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason: string;
}

/**
 * C4: authorize a partner call. Fails closed on unknown app, missing scope, or a
 * tenant the app is not registered for. Returns a reason for honest 403 copy.
 */
export function authorizeApplication(
  registry: ApplicationRegistry,
  appId: string,
  scope: PlatformScope,
  tenantId?: string,
): AuthorizationResult {
  const app = findApplication(registry, appId);
  if (!app) return { authorized: false, reason: `Unknown application "${appId}".` };
  if (!app.scopes.includes(scope)) {
    return { authorized: false, reason: `Application "${appId}" lacks the "${scope}" scope.` };
  }
  if (tenantId && !app.tenantIds.includes(tenantId)) {
    return { authorized: false, reason: `Application "${appId}" is not registered for tenant "${tenantId}".` };
  }
  return { authorized: true, reason: 'Authorized.' };
}

/** The demo application registry: one first-party app, one partner app. */
export function demoApplicationRegistry(): ApplicationRegistry {
  return {
    applications: [
      {
        appId: 'app-vitalcv-web',
        name: 'VitalCV Web',
        scopes: ['identity:read', 'evidence:read', 'trust:read', 'reasoning:read', 'events:subscribe'],
        tenantIds: ['vitalcv-careers', 'coastal-staffing'],
      },
      {
        appId: 'app-coastal-ats',
        name: 'Coastal ATS Integration',
        // A partner ATS may read trust/identity and subscribe to events, but not
        // reason or read raw evidence.
        scopes: ['identity:read', 'trust:read', 'events:subscribe'],
        tenantIds: ['coastal-staffing'],
      },
    ],
  };
}
