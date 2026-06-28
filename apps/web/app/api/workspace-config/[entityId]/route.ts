import { NextRequest, NextResponse } from 'next/server';
import { composeCareerModel } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { demoWorkspaceConfig, findRole, findDashboard, isRoleGranted } from '@/lib/workspace-config/config';
import { authenticateApp, appKeyEnvVar } from '@/lib/workspace-config/auth';
import { projectForRole } from '@/lib/workspace-config/roles';
import { evaluateWorkflow } from '@/lib/workspace-config/workflows';
import { projectDashboard } from '@/lib/workspace-config/dashboard';

export const runtime = 'nodejs';

/**
 * GET /api/workspace-config/[entityId]?role=<roleId>&dashboard=<dashboardId>
 *   — the configurable workspace projection (Wave 1300, C1/C2/C5).
 *
 * Resolves the canonical Career Model ONCE, then applies the workspace's role
 * configuration: a role-scoped view, the configured workflows evaluated against
 * real facts, and (optionally) a role-scoped dashboard. Configuration only
 * scopes/gates — it never alters trust or evidence. Unknown role ⇒ 403.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  try {
    const config = demoWorkspaceConfig();
    const { searchParams } = new URL(req.url);
    const roleId = searchParams.get('role') ?? 'clinician';
    const appId = searchParams.get('appId')?.trim() ?? '';

    const role = findRole(config, roleId);
    if (!role) {
      return NextResponse.json(
        { error: 'unknown_role', error_description: `Role "${roleId}" is not defined in this workspace.` },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Caller AUTHENTICATION first: the app must prove its identity with its
    // configured key, otherwise the appId is just an unverified claim. Fails
    // closed (401) when the key is missing/unconfigured/mismatched.
    const appKey = req.headers.get('x-app-key') ?? searchParams.get('appKey') ?? '';
    if (!authenticateApp(appId, appKey, process.env[appKeyEnvVar(appId)])) {
      return NextResponse.json(
        { error: 'app_not_authenticated', error_description: 'A valid appId and matching app key are required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Caller AUTHORIZATION: an authenticated app may only assume a granted role.
    if (!isRoleGranted(config, appId, roleId)) {
      return NextResponse.json(
        { error: 'role_not_granted', error_description: `Application "${appId}" may not assume role "${roleId}".` },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Core platform work happens ONCE; configuration is a pure projection on top.
    const passport = await resolvePassportRuntimePassport(entityId);
    const model = composeCareerModel(passportToEvidenceCollection(passport));

    const roleProjection = projectForRole(model, role.roleId, role.visibleSections);
    const workflows = config.workflows.map((wf) => evaluateWorkflow(wf, model));

    const dashboardId = searchParams.get('dashboard');
    const dashboardConfig = dashboardId ? findDashboard(config, dashboardId) : null;
    const dashboard =
      dashboardConfig && dashboardConfig.roleIds.includes(role.roleId)
        ? projectDashboard(dashboardConfig, roleProjection)
        : null;

    return NextResponse.json(
      {
        schema: 'vitalcv.workspace-config.v1',
        workspaceId: config.workspaceId,
        tenantId: config.tenantId,
        role: { roleId: role.roleId, label: role.label },
        projection: roleProjection,
        workflows,
        dashboard,
      },
      { status: 200, headers: { ETag: `W/"${model.meta.contentHash}"`, 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Workspace projection failed.';
    return NextResponse.json(
      { error: 'workspace_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
