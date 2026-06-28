import { NextRequest, NextResponse } from 'next/server';
import { demoPlatformRegistry } from '@/lib/platform-cloud/registry';
import { demoApplicationRegistry, authorizeApplication } from '@/lib/platform-cloud/applications';
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

    const auth = authorizeApplication(demoApplicationRegistry(), appId, 'identity:read');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'app_not_authorized', error_description: auth.reason },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const registry = demoPlatformRegistry();
    const production = process.env.NODE_ENV === 'production';
    const readiness = platformReadiness(
      registry,
      (tenantId) => process.env[`TRUST_CLOUD_SECRET_${tenantId.toUpperCase().replace(/-/g, '_')}`],
      production,
    );

    return NextResponse.json(
      {
        schema: 'vitalcv.platform-manifest.v1',
        cloudId: registry.cloudId,
        tenants: registry.tenants.map((t) => ({ tenantId: t.tenantId, name: t.name, kind: t.kind })),
        eventTypes: PLATFORM_EVENT_TYPES,
        readiness,
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
