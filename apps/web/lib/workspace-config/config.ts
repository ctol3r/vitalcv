/**
 * Workspace configuration service (Wave 1300, C1)
 * ──────────────────────────────────────────────────────────────────────────
 * The declarative configuration that lets one platform serve many healthcare
 * organizations without forking: per-workspace roles, workflows, automations,
 * and dashboards. Configuration is DATA — it selects, gates, and routes over
 * the shared platform services; it never carries business logic or trust facts.
 *
 * Validation is strict so a malformed tenant config fails fast rather than
 * silently mis-scoping a role or binding a widget to a non-existent section.
 */
import { CAREER_SECTIONS, type CareerSection } from './roles';
import { isFactualGate, type WorkflowDefinition } from './workflows';
import type { AutomationRule } from './automation';
import type { DashboardConfig } from './dashboard';
import { PLATFORM_EVENT_TYPES } from '@/lib/platform-cloud/events';

export interface WorkspaceRole {
  roleId: string;
  label: string;
  /** Career Model sections this role may see. */
  visibleSections: CareerSection[];
}

/** Which application/principal may assume which role in this workspace. */
export interface RoleGrant {
  appId: string;
  roleId: string;
}

export interface WorkspaceConfig {
  workspaceId: string;
  tenantId: string;
  roles: WorkspaceRole[];
  /** Caller authorization: an app may only assume a role it is granted. */
  grants: RoleGrant[];
  workflows: WorkflowDefinition[];
  automations: AutomationRule[];
  dashboards: DashboardConfig[];
}

export function findRole(config: WorkspaceConfig, roleId: string): WorkspaceRole | null {
  const id = roleId?.trim();
  if (!id) return null;
  return config.roles.find((r) => r.roleId === id) ?? null;
}

/**
 * Caller authorization: an application may assume a role ONLY if the workspace
 * grants it. Fails closed — no appId, or no matching grant ⇒ not authorized.
 * This stops a caller from simply requesting the broadest role.
 */
export function isRoleGranted(config: WorkspaceConfig, appId: string, roleId: string): boolean {
  const id = appId?.trim();
  if (!id) return false;
  return config.grants.some((g) => g.appId === id && g.roleId === roleId);
}

export function findDashboard(config: WorkspaceConfig, dashboardId: string): DashboardConfig | null {
  return config.dashboards.find((d) => d.dashboardId === dashboardId) ?? null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SECTION_SET = new Set<string>(CAREER_SECTIONS);
const EVENT_SET = new Set<string>(PLATFORM_EVENT_TYPES);

/** Strict structural validation — fail fast on a malformed tenant config. */
export function validateWorkspaceConfig(config: WorkspaceConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.workspaceId?.trim()) errors.push('workspaceId is required.');
  if (!config.tenantId?.trim()) errors.push('tenantId is required.');

  const roleIds = new Set<string>();
  for (const role of config.roles) {
    if (roleIds.has(role.roleId)) errors.push(`duplicate roleId "${role.roleId}".`);
    roleIds.add(role.roleId);
    for (const s of role.visibleSections) {
      if (!SECTION_SET.has(s)) errors.push(`role "${role.roleId}" references unknown section "${s}".`);
    }
  }

  for (const wf of config.workflows) {
    if (wf.steps.length === 0) errors.push(`workflow "${wf.workflowId}" has no steps.`);
    for (const step of wf.steps) {
      // A step gate must impose a real requirement — never an empty/degenerate
      // gate that would complete the step without a decision-grade fact.
      if (!isFactualGate(step.gate)) {
        errors.push(`workflow "${wf.workflowId}" step "${step.stepId}" has a non-factual gate.`);
      }
    }
  }

  for (const grant of config.grants) {
    if (!grant.appId?.trim()) errors.push('a role grant is missing appId.');
    if (!roleIds.has(grant.roleId)) errors.push(`grant references unknown role "${grant.roleId}".`);
  }

  for (const rule of config.automations) {
    if (!EVENT_SET.has(rule.on)) errors.push(`automation "${rule.ruleId}" triggers on unknown event "${rule.on}".`);
  }

  for (const dash of config.dashboards) {
    for (const rid of dash.roleIds) {
      if (!roleIds.has(rid)) errors.push(`dashboard "${dash.dashboardId}" references unknown role "${rid}".`);
    }
    for (const w of dash.widgets) {
      if (!SECTION_SET.has(w.source)) errors.push(`widget "${w.widgetId}" binds to unknown section "${w.source}".`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** A demo workspace: a clinician self-view, a recruiter view, and a credentialer view. */
export function demoWorkspaceConfig(): WorkspaceConfig {
  return {
    workspaceId: 'mercy-health-workspace',
    tenantId: 'coastal-staffing',
    roles: [
      {
        roleId: 'clinician',
        label: 'Clinician (self)',
        visibleSections: ['evidence', 'trust', 'timeline', 'mobility', 'readiness', 'organizations', 'growth', 'intelligence', 'longitudinal'],
      },
      {
        // A recruiter sees readiness/trust/orgs but NOT raw evidence or growth coaching.
        roleId: 'recruiter',
        label: 'Recruiter',
        visibleSections: ['trust', 'readiness', 'mobility', 'organizations'],
      },
      {
        // A credentialer sees evidence + trust + readiness, not growth/intelligence.
        roleId: 'credentialer',
        label: 'Credentialing Specialist',
        visibleSections: ['evidence', 'trust', 'readiness', 'organizations'],
      },
    ],
    grants: [
      // The first-party app may act as the clinician self-view; the partner ATS
      // is limited to the recruiter role — it can never request the clinician view.
      { appId: 'app-vitalcv-web', roleId: 'clinician' },
      { appId: 'app-vitalcv-web', roleId: 'credentialer' },
      { appId: 'app-coastal-ats', roleId: 'recruiter' },
    ],
    workflows: [
      {
        workflowId: 'recognition-to-start',
        label: 'Recognition → Acceptance → Start',
        steps: [
          { stepId: 'recognition', label: 'Recognition', gate: { minDecisionGradeEvidence: 1 } },
          { stepId: 'acceptance', label: 'Acceptance', gate: { readinessIn: ['near_ready', 'ready'] } },
          { stepId: 'start', label: 'Start', gate: { readinessIn: ['ready'] } },
        ],
      },
    ],
    automations: [
      {
        ruleId: 'verified-notify-recruiter',
        on: 'exchange.verified',
        action: { type: 'notify', target: 'recruiter-queue' },
      },
      {
        ruleId: 'readiness-ready-route',
        on: 'readiness.changed',
        whenPayloadEquals: { key: 'readiness', value: 'ready' },
        action: { type: 'route_to_review', target: 'privileging' },
      },
    ],
    dashboards: [
      {
        dashboardId: 'recruiter-dash',
        label: 'Recruiter Dashboard',
        roleIds: ['recruiter'],
        widgets: [
          { widgetId: 'w-readiness', title: 'Readiness', type: 'summary', source: 'readiness' },
          { widgetId: 'w-trust', title: 'Trust', type: 'metric', source: 'trust' },
          // Bound to a section the recruiter cannot see → resolves hidden, not fabricated.
          { widgetId: 'w-evidence', title: 'Evidence', type: 'list', source: 'evidence' },
        ],
      },
    ],
  };
}
