/**
 * FOUNDATION-SWEEP-3 — recovery / mobile / degraded / support / demo
 * foundation tests.
 *
 * Truth invariants enforced:
 *   - Account recovery is foundation-only (no live method, no
 *     production recovery claim).
 *   - Biometric recovery is not present and not claimed.
 *   - Recovery includes the holder-notification + distinct-from-auth
 *     requirements.
 *   - Mobile capture says native capture is not live; checklist
 *     includes touch targets, reduced motion, and degraded-network
 *     notice.
 *   - Degraded-state policy says offline sync is not implemented and
 *     never produces a clinician-defect signal.
 *   - Support / admin plan is foundation-only with no live staffed
 *     support.
 *   - Demo reset plan is non-production AND non-destructive across
 *     every scope.
 *   - Routes carry the required safe copy.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildAccountRecoveryFoundationPolicy,
  evaluateAccountRecoveryReadiness,
  explainAccountRecoveryMethod,
  type AccountRecoveryMethod,
} from '../lib/account-recovery/accountRecoveryFoundation';
import {
  buildMobileCaptureFoundationPlan,
  explainMobileCaptureStatus,
  type MobileCaptureCapability,
} from '../lib/mobile/mobileCaptureFoundation';
import {
  buildDegradedStateFoundationPolicy,
  explainDegradedState,
  type DegradedStateKind,
} from '../lib/degraded-state/degradedStateFoundation';
import {
  buildSupportAdminFoundationPlan,
  explainSupportAdminStatus,
} from '../lib/support-admin/supportAdminFoundation';
import {
  buildDemoResetFoundationPlan,
  explainDemoResetSafety,
} from '../lib/demo/demoResetFoundation';

// ────────────────────────────────────────────────────────────────────────────
// Account recovery
// ────────────────────────────────────────────────────────────────────────────

describe('account recovery foundation', () => {
  const policy = buildAccountRecoveryFoundationPolicy();

  it('includes saved code, issued code, contact, repeated proofing, and support review methods', () => {
    const expected: AccountRecoveryMethod[] = [
      'saved_recovery_code',
      'issued_recovery_code',
      'recovery_contact',
      'repeated_identity_proofing',
      'support_review',
    ];
    const actual = policy.methods.map((m) => m.method).sort();
    expect(actual).toEqual(expected.sort());
  });

  it('does not claim production account recovery', () => {
    expect(policy.disclaimers.some((d) => /Production account recovery is not enabled/.test(d))).toBe(true);
    for (const m of policy.methods) {
      expect(m.isLive).toBe(false);
    }
  });

  it('does not claim biometric recovery is live', () => {
    const text = JSON.stringify(policy);
    // No biometric_recovery method enum, and the disclaimer explicitly negates it
    expect(policy.methods.find((m) => /biometric/i.test(m.method))).toBeUndefined();
    expect(policy.disclaimers.some((d) => /Biometric recovery is not implemented/.test(d))).toBe(true);
    // Defensive: no live=true biometric anywhere
    expect(text.toLowerCase()).not.toContain('biometric recovery live');
  });

  it('includes the holder-notification requirement', () => {
    const req = policy.requirements.find((r) => r.id === 'holder_notification');
    expect(req).toBeDefined();
    expect(req!.meetsToday).toBe(false);
  });

  it('declares recovery distinct from authentication', () => {
    const req = policy.requirements.find((r) => r.id === 'recovery_distinct_from_auth');
    expect(req).toBeDefined();
    expect(req!.explanation).toMatch(/does not itself authorize a session/);
    for (const m of policy.methods) {
      expect(m.reauthorizesSessionOnSuccess).toBe(false);
    }
  });

  it('readiness caps at foundation_ready and never returns productionReady=true', () => {
    const r = evaluateAccountRecoveryReadiness({
      hasSavedRecoveryCode: true,
      hasRecoveryContact: true,
      identityProofingFoundationReady: true,
    });
    expect(r.readiness).toBe('foundation_ready');
    expect(r.productionReady).toBe(false);
  });

  it('explainAccountRecoveryMethod returns text for every method', () => {
    const all: AccountRecoveryMethod[] = [
      'saved_recovery_code',
      'issued_recovery_code',
      'recovery_contact',
      'repeated_identity_proofing',
      'support_review',
    ];
    for (const m of all) {
      expect(explainAccountRecoveryMethod(m).length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Mobile capture
// ────────────────────────────────────────────────────────────────────────────

describe('mobile capture foundation', () => {
  const plan = buildMobileCaptureFoundationPlan();

  it('scope is mobile web / PWA only — never claims native', () => {
    expect(plan.scope).toBe('mobile_web_pwa_only');
    expect(plan.disclaimers.some((d) => /Native iOS and Android apps are not shipped/.test(d))).toBe(true);
  });

  it('does not claim native camera capture is live', () => {
    expect(plan.disclaimers.some((d) => /Native camera workflows are not enabled/.test(d))).toBe(true);
    for (const r of plan.requirements) {
      expect(r.isLive).toBe(false);
    }
  });

  it('includes the required capability set', () => {
    const required: MobileCaptureCapability[] = [
      'responsive_file_upload',
      'camera_capture_placeholder',
      'document_preview',
      'upload_error_handling',
      'mobile_touch_targets',
      'reduced_motion',
      'degraded_network_notice',
    ];
    const present = plan.requirements.map((r) => r.capability);
    for (const c of required) expect(present).toContain(c);
  });

  it('explainMobileCaptureStatus returns text for every status', () => {
    expect(explainMobileCaptureStatus('foundation_planned').length).toBeGreaterThan(0);
    expect(explainMobileCaptureStatus('foundation_ready').length).toBeGreaterThan(0);
    expect(explainMobileCaptureStatus('partial').length).toBeGreaterThan(0);
    expect(explainMobileCaptureStatus('unavailable').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Degraded state
// ────────────────────────────────────────────────────────────────────────────

describe('degraded state foundation', () => {
  const policy = buildDegradedStateFoundationPolicy();

  it('declares offline sync is not implemented', () => {
    expect(policy.offlineSyncImplemented).toBe(false);
    expect(policy.disclaimers.some((d) => /Offline sync is not implemented/.test(d))).toBe(true);
  });

  it('never treats source outage as a clinician defect', () => {
    expect(policy.sourceOutageIsClinicianDefect).toBe(false);
    expect(policy.disclaimers.some((d) => /not a defect of the clinician/.test(d))).toBe(true);
    const text = JSON.stringify(policy).toLowerCase();
    expect(text).not.toContain('clinician defect');
  });

  it('every notice has a user-safe heading + body + remediation (no raw payload / stack / secret)', () => {
    for (const n of policy.notices) {
      expect(n.heading.length).toBeGreaterThan(0);
      expect(n.heading.length).toBeLessThanOrEqual(64);
      expect(n.body.length).toBeGreaterThan(0);
      expect(n.remediation.length).toBeGreaterThan(0);
      const txt = JSON.stringify(n).toLowerCase();
      expect(txt).not.toContain('stack');
      expect(txt).not.toContain('secret');
      expect(txt).not.toContain('token');
    }
  });

  it('explainDegradedState returns the matching notice for every kind', () => {
    const kinds: DegradedStateKind[] = [
      'offline',
      'upstream_unavailable',
      'upload_failed',
      'source_probe_unknown',
      'retry_required',
      'local_draft_only',
    ];
    for (const k of kinds) {
      const n = explainDegradedState(k);
      expect(n.kind).toBe(k);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Support / admin
// ────────────────────────────────────────────────────────────────────────────

describe('support / admin foundation', () => {
  const plan = buildSupportAdminFoundationPlan();

  it('is foundation-only — staffed=false and productionAdminEnabled=false', () => {
    expect(plan.staffed).toBe(false);
    expect(plan.productionAdminEnabled).toBe(false);
  });

  it('every capability is foundation_planned, none isLive', () => {
    for (const r of plan.requirements) {
      expect(r.isLive).toBe(false);
      expect(r.status).toBe('foundation_planned');
    }
  });

  it('includes the required capability set', () => {
    const required = [
      'support_intake',
      'issue_triage',
      'admin_review_queue',
      'audit_safe_note',
      'demo_reset_request',
      'escalation_policy',
    ];
    const present = plan.requirements.map((r) => r.capability);
    for (const c of required) expect(present).toContain(c);
  });

  it('disclaimers say not staffed and non-destructive', () => {
    expect(plan.disclaimers.some((d) => /Support and admin are foundation-only/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /No destructive database changes/.test(d))).toBe(true);
  });

  it('explainSupportAdminStatus returns text for every status', () => {
    expect(explainSupportAdminStatus('foundation_planned').length).toBeGreaterThan(0);
    expect(explainSupportAdminStatus('foundation_ready').length).toBeGreaterThan(0);
    expect(explainSupportAdminStatus('partial').length).toBeGreaterThan(0);
    expect(explainSupportAdminStatus('unavailable').length).toBeGreaterThan(0);
  });
});

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
  it('account/recovery page renders the production-not-enabled disclaimer', () => {
    const src = readRoute('account/recovery/page.tsx');
    expect(src).toContain('This page describes recovery foundations. Production account recovery is not enabled yet.');
  });

  it('account/recovery page does not claim biometric recovery is live', () => {
    const src = readRoute('account/recovery/page.tsx').toLowerCase();
    expect(src).not.toContain('biometric recovery live');
    expect(src).not.toContain('production account recovery is live');
  });

  it('clinician/mobile-capture page renders the web/PWA-foundation disclaimer', () => {
    const src = readRoute('clinician/mobile-capture/page.tsx');
    expect(src).toContain('Mobile document capture is a web/PWA foundation. Native camera workflows are not enabled yet.');
  });

  it('clinician/mobile-capture page does not claim native camera capture or offline sync is live', () => {
    const src = readRoute('clinician/mobile-capture/page.tsx').toLowerCase();
    expect(src).not.toContain('native camera capture live');
    expect(src).not.toContain('offline sync implemented');
  });

  it('support page renders the foundation-only disclaimer', () => {
    const src = readRoute('support/page.tsx');
    expect(src).toContain('Support and admin are foundation-only this wave. No staffed support is live and no production admin powers are exposed.');
  });

  it('admin/demo-reset page renders the non-production + operator-confirmation disclaimer', () => {
    const src = readRoute('admin/demo-reset/page.tsx');
    expect(src).toContain('Demo reset plans are non-production and require explicit operator confirmation.');
  });

  it('no foundation-sweep-3 route contains blanket truth-contract banned phrases', () => {
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
    for (const rel of [
      'account/recovery/page.tsx',
      'clinician/mobile-capture/page.tsx',
      'support/page.tsx',
      'admin/demo-reset/page.tsx',
    ]) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of banned) expect(src).not.toContain(phrase);
    }
  });
});
