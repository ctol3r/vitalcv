/**
 * FOUNDATION-SWEEP-3 — demo-reset foundation tests.
 *
 * Truth invariants enforced:
 *   - Demo reset plan is non-production AND non-destructive across
 *     every scope.
 *   - The /admin/demo-reset route carries the required safe copy.
 *
 * The account-recovery / mobile-capture / degraded-state / support-admin
 * blocks left with their surfaces: the 2026-08-07 orphaned-route
 * retirement deleted those foundation pages and spec modules
 * (headerless-routes disposition, bucket D), so the claims those guards
 * policed no longer ship anywhere. Demo reset stays: /admin/demo-reset is
 * a live (bucket C) surface and its non-destructive contract remains
 * load-bearing.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildDemoResetFoundationPlan,
  explainDemoResetSafety,
} from '../lib/demo/demoResetFoundation';

// ────────────────────────────────────────────────────────────────────────────
// Demo reset
// ────────────────────────────────────────────────────────────────────────────

describe('demo reset foundation', () => {
  const plan = buildDemoResetFoundationPlan();

  it('plan is non-production and non-destructive across every scope', () => {
    expect(plan.productionResetEnabled).toBe(false);
    expect(plan.destructive).toBe(false);
    for (const s of plan.scopes) {
      expect(s.isLive).toBe(false);
      expect(s.destructiveToProduction).toBe(false);
      expect(s.requiresOperatorConfirmation).toBe(true);
    }
  });

  it('includes the documented scopes', () => {
    const required = [
      'demo_session',
      'demo_clinician_profile',
      'demo_issuer_request',
      'demo_review_decision',
      'demo_import_inbox',
    ];
    const present = plan.scopes.map((s) => s.scope);
    for (const c of required) expect(present).toContain(c);
  });

  it('disclaimers explicitly bound the scope to demo data + operator confirmation', () => {
    expect(plan.disclaimers.some((d) => /non-production and require explicit operator confirmation/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /No destructive database changes/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /Real clinician records.*out of every demo reset scope/.test(d))).toBe(true);
  });

  it('explainDemoResetSafety mentions demo bounds + operator confirmation for each scope', () => {
    for (const s of plan.scopes) {
      const explanation = explainDemoResetSafety(s);
      expect(explanation).toMatch(/bounded to demo data/);
      expect(explanation).toMatch(/operator confirmation/);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Route copy invariants
// ────────────────────────────────────────────────────────────────────────────

const APP_ROOT = resolve(__dirname, '..', 'app');
const readRoute = (rel: string) => readFileSync(resolve(APP_ROOT, rel), 'utf-8');

describe('route copy invariants', () => {
  it('admin/demo-reset page renders the non-production + operator-confirmation disclaimer', () => {
    const src = readRoute('admin/demo-reset/page.tsx');
    expect(src).toContain('Demo reset plans are non-production and require explicit operator confirmation.');
  });

  it('admin/demo-reset contains no blanket truth-contract banned phrases', () => {
    const banned = [
      'guaranteed verification',
      'instant credentialing',
      'complete credentialing',
      'legally accepted',
      'risk transferred',
      'hipaa compliant',
      'soc2 certified',
      'ncqa verified',
      'irreversible proof',
      'tamper-proof',
      'destructive reset',
      'production admin enabled',
      'staffed support live',
    ];
    const src = readRoute('admin/demo-reset/page.tsx').toLowerCase();
    for (const phrase of banned) expect(src).not.toContain(phrase);
  });
});
