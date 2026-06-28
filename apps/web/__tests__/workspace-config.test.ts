/**
 * Wave 1300 — Configurable Platform integration (C6)
 * ──────────────────────────────────────────────────────────────────────────
 * Chain: Workspace → Roles → Workflow → Evidence → Trust → Career →
 * Organization → Automation, all driven by declarative configuration over the
 * shared platform services. Asserts the load-bearing rule: configuration scopes,
 * gates, and routes — it NEVER alters, fabricates, or elevates trust facts.
 */
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as workspaceGET } from '../app/api/workspace-config/[entityId]/route';
import { buildDemoPassport } from '../lib/demo/demo-passport';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { composeCareerModel } from '@vitalcv/domain-evidence';
import { demoWorkspaceConfig, validateWorkspaceConfig, findRole, isRoleGranted } from '../lib/workspace-config/config';
import { projectForRole, CAREER_SECTIONS } from '../lib/workspace-config/roles';
import { evaluateWorkflow } from '../lib/workspace-config/workflows';
import { evaluateAutomations } from '../lib/workspace-config/automation';
import { projectDashboard } from '../lib/workspace-config/dashboard';

function model() {
  return composeCareerModel(passportToEvidenceCollection(buildDemoPassport()));
}

describe('Configurable Platform (C1/C6)', () => {
  it('the demo workspace configuration validates', () => {
    expect(validateWorkspaceConfig(demoWorkspaceConfig())).toEqual({ valid: true, errors: [] });
  });

  it('catches a malformed config (unknown section / role / event)', () => {
    const bad = demoWorkspaceConfig();
    bad.roles[0].visibleSections = ['not_a_section' as never];
    bad.automations[0].on = 'not.an.event' as never;
    const res = validateWorkspaceConfig(bad);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('role projection HIDES sections but never alters the underlying facts', () => {
    const m = model();
    const recruiter = findRole(demoWorkspaceConfig(), 'recruiter')!;
    const proj = projectForRole(m, recruiter.roleId, recruiter.visibleSections);

    // Recruiter cannot see raw evidence or growth.
    expect(proj.hiddenSections).toContain('evidence');
    expect(proj.hiddenSections).toContain('growth');
    expect(proj.sections.evidence).toBeUndefined();

    // Visible sections are the SAME facts — pass-through by reference, unchanged.
    expect(proj.sections.trust).toBe(m.trust);
    expect(proj.sections.readiness).toBe(m.readiness);
    // meta decision-grade count is the real one — projection can't inflate it.
    expect(proj.meta.decisionGradeEvidence).toBe(m.meta.decisionGradeEvidence);
  });

  it('no role can surface more decision-grade evidence than actually exists', () => {
    const m = model();
    const config = demoWorkspaceConfig();
    for (const role of config.roles) {
      const proj = projectForRole(m, role.roleId, role.visibleSections);
      // If trust is visible, its decision-grade count equals the real model's.
      if (proj.sections.trust) {
        expect(proj.sections.trust.overall.decisionGradeEvidence).toBe(m.trust.overall.decisionGradeEvidence);
      }
      // Visible sections are always a subset of the canonical sections.
      expect(proj.visibleSections.every((s) => (CAREER_SECTIONS as readonly string[]).includes(s))).toBe(true);
    }
  });

  it('rejects an empty/degenerate workflow gate — config cannot force completion', () => {
    const m = model();
    const bad = demoWorkspaceConfig();
    bad.workflows[0].steps[0].gate = {}; // empty gate
    expect(validateWorkspaceConfig(bad).valid).toBe(false);

    // And defensively: an empty gate never satisfies (step is not 'complete').
    const evaln = evaluateWorkflow(bad.workflows[0], m);
    expect(evaln.steps[0].state).not.toBe('complete');

    // A degenerate "needs 0" gate is also non-factual.
    const degenerate = demoWorkspaceConfig();
    degenerate.workflows[0].steps[0].gate = { minDecisionGradeEvidence: 0 };
    expect(validateWorkspaceConfig(degenerate).valid).toBe(false);
  });

  it('route authenticates the caller before authorizing — a claimed appId is not enough', async () => {
    // Configure per-app keys (server-side secrets).
    process.env.WORKSPACE_APP_KEY_APP_COASTAL_ATS = 'coastal-secret';
    process.env.WORKSPACE_APP_KEY_APP_VITALCV_WEB = 'web-secret';

    const call = (qs: string, headers?: Record<string, string>) =>
      workspaceGET(
        new NextRequest(`http://localhost/api/workspace-config/demo-clinician?${qs}`, { headers }),
        { params: Promise.resolve({ entityId: 'demo-clinician' }) },
      );

    // THE BYPASS CODEX FOUND: claiming a granted appId WITHOUT its key must fail
    // closed (401) — you cannot just assert appId=app-vitalcv-web.
    const spoof = await call('role=clinician&appId=app-vitalcv-web');
    expect(spoof.status).toBe(401);
    expect((await spoof.json()).error).toBe('app_not_authenticated');

    // Wrong key → 401.
    const wrongKey = await call('role=clinician&appId=app-vitalcv-web&appKey=not-the-key');
    expect(wrongKey.status).toBe(401);

    // No appId at all → 401.
    expect((await call('role=clinician')).status).toBe(401);

    // Authenticated app, but role NOT granted → 403 (authn passes, authz fails).
    const denied = await call('role=clinician&appId=app-coastal-ats', { 'x-app-key': 'coastal-secret' });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toBe('role_not_granted');

    // Authenticated + granted role → 200, still correctly section-scoped.
    const ok = await call('role=recruiter&appId=app-coastal-ats', { 'x-app-key': 'coastal-secret' });
    expect(ok.status).toBe(200);
    const json = await ok.json();
    expect(json.role.roleId).toBe('recruiter');
    expect(json.projection.hiddenSections).toContain('evidence');

    delete process.env.WORKSPACE_APP_KEY_APP_COASTAL_ATS;
    delete process.env.WORKSPACE_APP_KEY_APP_VITALCV_WEB;
  });

  it('role grant check is fail-closed at the unit level too', () => {
    const cfg = demoWorkspaceConfig();
    expect(isRoleGranted(cfg, 'app-coastal-ats', 'recruiter')).toBe(true);
    expect(isRoleGranted(cfg, 'app-coastal-ats', 'clinician')).toBe(false);
    expect(isRoleGranted(cfg, '', 'clinician')).toBe(false);
  });

  it('workflow steps are gated by REAL decision-grade facts, not configuration', () => {
    const m = model();
    const wf = demoWorkspaceConfig().workflows[0];
    const evaln = evaluateWorkflow(wf, m);
    expect(evaln.subjectKey).toBe(m.identity.subjectKey);
    expect(evaln.steps).toHaveLength(3);

    // recognition needs >=1 decision-grade evidence — the demo has it.
    const recognition = evaln.steps.find((s) => s.stepId === 'recognition')!;
    expect(recognition.state).toBe(m.meta.decisionGradeEvidence >= 1 ? 'complete' : 'available');

    // A workflow can never invent completion: a step gated on readiness 'ready'
    // is only complete when readiness is actually 'ready'.
    const start = evaln.steps.find((s) => s.stepId === 'start')!;
    if (m.readiness.readiness !== 'ready') expect(start.state).not.toBe('complete');
  });

  it('automation fires configured actions on real events, fails closed on unknown types', () => {
    const rules = demoWorkspaceConfig().automations;
    const fired = evaluateAutomations(rules, {
      type: 'exchange.verified',
      tenantId: 'coastal-staffing',
      subjectKey: 'demo-clinician',
      payload: {},
    });
    expect(fired.map((f) => f.ruleId)).toContain('verified-notify-recruiter');

    // Conditional rule only fires when the payload condition holds.
    const notReady = evaluateAutomations(rules, {
      type: 'readiness.changed',
      tenantId: 'coastal-staffing',
      subjectKey: 'demo-clinician',
      payload: { readiness: 'near_ready' },
    });
    expect(notReady.find((f) => f.ruleId === 'readiness-ready-route')).toBeUndefined();

    // Unknown event type → nothing fires.
    expect(
      evaluateAutomations(rules, { type: 'bogus' as never, tenantId: 't', subjectKey: 's', payload: {} }),
    ).toHaveLength(0);
  });

  it('dashboard widgets bound to a hidden section resolve hidden, never fabricated', () => {
    const m = model();
    const config = demoWorkspaceConfig();
    const recruiter = findRole(config, 'recruiter')!;
    const proj = projectForRole(m, recruiter.roleId, recruiter.visibleSections);
    const dash = projectDashboard(config.dashboards[0], proj);

    const evidenceWidget = dash.widgets.find((w) => w.widgetId === 'w-evidence')!;
    expect(evidenceWidget.status).toBe('hidden'); // recruiter can't see evidence
    expect(evidenceWidget.data).toBeNull();

    const trustWidget = dash.widgets.find((w) => w.widgetId === 'w-trust')!;
    expect(trustWidget.status).toBe('ok');
    expect(trustWidget.data).toBe(m.trust); // pass-through, unchanged
  });
});
