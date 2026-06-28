import { NextRequest, NextResponse } from 'next/server';
import { demoPlatformRegistry } from '@/lib/platform-cloud/registry';
import { demoApplicationRegistry, authorizeApplication, findApplication } from '@/lib/platform-cloud/applications';
import { platformReadiness } from '@/lib/platform-cloud/readiness';
import { PLATFORM_EVENT_TYPES } from '@/lib/platform-cloud/events';

export const runtime = 'nodejs';

/**
 * GET /api/platform/manifest — Partner API (Wave 900, C4).
 *
 * The scope-gated capability surface for the Professional Trust Cloud. A partner
 * app authenticates via `?appId=` and must hold the `identity:read` scope. The
 * manifest lists tenants, event types, and per-tenant readiness — never any
 * provider data. Fails closed: unknown app or missing scope ⇒ 403.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId')?.trim() ?? '';

    const appRegistry = demoApplicationRegistry();
    const auth = authorizeApplication(appRegistry, appId, 'identity:read');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'app_not_authorized', error_description: auth.reason },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Tenant isolation: an app sees ONLY the tenants it is registered for, never
    // the whole cloud. (authorizeApplication passed, so the app exists.)
    const app = findApplication(appRegistry, appId)!;
    const allowed = new Set(app.tenantIds);

    const registry = demoPlatformRegistry();
    const production = process.env.NODE_ENV === 'production';
    const fullReadiness = platformReadiness(
      registry,
      (tenantId) => process.env[`TRUST_CLOUD_SECRET_${tenantId.toUpperCase().replace(/-/g, '_')}`],
      production,
    );

    const tenants = registry.tenants
      .filter((t) => allowed.has(t.tenantId))
      .map((t) => ({ tenantId: t.tenantId, name: t.name, kind: t.kind }));
    const scopedReadinessTenants = fullReadiness.tenants.filter((t) => allowed.has(t.tenantId));

    return NextResponse.json(
      {
        schema: 'vitalcv.platform-manifest.v1',
        cloudId: registry.cloudId,
        tenants,
        eventTypes: PLATFORM_EVENT_TYPES,
        readiness: {
          cloudId: fullReadiness.cloudId,
          production,
          tenants: scopedReadinessTenants,
          ready: scopedReadinessTenants.every((t) => t.ready),
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Manifest unavailable.';
    return NextResponse.json(
      { error: 'manifest_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
