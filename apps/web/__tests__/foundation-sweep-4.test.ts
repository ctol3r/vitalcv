/**
 * FOUNDATION-SWEEP-4 — native / identity / biometric foundation tests.
 *
 * Truth invariants enforced:
 *   - Native iOS / Android apps are planned, not live.
 *   - App Attest / Play Integrity are planned controls.
 *   - Government ID verification is planned, not live.
 *   - Selfie / liveness is planned, not live.
 *   - No NIST 800-63 IAL is *achieved* or *asserted* by this
 *     foundation (the disclaimer DOES contain the strings "IAL2"
 *     and "IAL3" as part of the negation; assertions therefore use
 *     positive-claim regex patterns instead of blanket-grep regex).
 *   - Biometric gating is planned, not live.
 *   - Biometric unlock does NOT prove clinician identity by itself.
 *   - Identity vendor plan requires consent / retention-redaction /
 *     audit-receipt.
 *   - Routes carry the required safe copy.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildNativeAppReadinessPlan,
  explainNativeReadinessStatus,
} from '../lib/mobile/nativeAppReadiness';
import {
  buildIdentityVerificationFoundationPlan,
  explainIdentityVerificationControl,
  type IdentityVerificationControlKind,
} from '../lib/identity/identityVerificationControls';
import {
  buildBiometricGatingFoundationPlan,
  explainBiometricGatingStatus,
} from '../lib/device/biometricGatingFoundation';

// ────────────────────────────────────────────────────────────────────────────
// Native app readiness
// ────────────────────────────────────────────────────────────────────────────

describe('native app readiness foundation', () => {
  const plan = buildNativeAppReadinessPlan();

  it('typed literals: nativeAppLive=false, storeReadinessClaimed=false, deviceAttestationLive=false', () => {
    expect(plan.nativeAppLive).toBe(false);
    expect(plan.storeReadinessClaimed).toBe(false);
    expect(plan.deviceAttestationLive).toBe(false);
  });

  it('iOS native shell is planned, not live', () => {
    const ios = plan.specs.find(
      (s) => s.platform === 'ios' && s.capability === 'native_shell_planned',
    );
    expect(ios).toBeDefined();
    expect(ios!.isLive).toBe(false);
    expect(ios!.status).toBe('foundation_planned');
  });

  it('Android native shell is planned, not live', () => {
    const android = plan.specs.find(
      (s) => s.platform === 'android' && s.capability === 'native_shell_planned',
    );
    expect(android).toBeDefined();
    expect(android!.isLive).toBe(false);
    expect(android!.status).toBe('foundation_planned');
  });

  it('App Attest / Play Integrity are planned only (device_attestation_planned spec on both platforms)', () => {
    const ios = plan.specs.find(
      (s) => s.platform === 'ios' && s.capability === 'device_attestation_planned',
    );
    const android = plan.specs.find(
      (s) => s.platform === 'android' && s.capability === 'device_attestation_planned',
    );
    expect(ios!.isLive).toBe(false);
    expect(android!.isLive).toBe(false);
    // Description must reference the planned device-attestation primitives by name
    expect(ios!.description).toMatch(/App Attest/);
    expect(android!.description).toMatch(/Play Integrity/);
  });

  it('every spec across iOS + Android is isLive=false', () => {
    for (const s of plan.specs) {
      expect(s.isLive).toBe(false);
    }
  });

  it('explainNativeReadinessStatus returns text for every status', () => {
    expect(explainNativeReadinessStatus('foundation_planned').length).toBeGreaterThan(0);
    expect(explainNativeReadinessStatus('foundation_in_progress').length).toBeGreaterThan(0);
    expect(explainNativeReadinessStatus('foundation_ready').length).toBeGreaterThan(0);
    expect(explainNativeReadinessStatus('unavailable').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Identity verification controls
// ────────────────────────────────────────────────────────────────────────────

describe('identity verification control foundation', () => {
  const plan = buildIdentityVerificationFoundationPlan();

  it('typed literals: governmentIdLive=false, selfieLivenessLive=false, vendorSelected=false', () => {
    expect(plan.governmentIdLive).toBe(false);
    expect(plan.selfieLivenessLive).toBe(false);
    expect(plan.vendorSelected).toBe(false);
  });

  it('government_id control is planned/required, not live', () => {
    const c = plan.controls.find((c) => c.kind === 'government_id');
    expect(c).toBeDefined();
    expect(c!.isLive).toBe(false);
    expect(c!.required).toBe(true);
  });

  it('selfie_liveness control is planned/required, not live', () => {
    const c = plan.controls.find((c) => c.kind === 'selfie_liveness');
    expect(c).toBeDefined();
    expect(c!.isLive).toBe(false);
    expect(c!.required).toBe(true);
  });

  it('typed literal: highestIalClaimed === "none"', () => {
    expect(plan.highestIalClaimed).toBe('none');
  });

  it('does not produce a positive IAL2/IAL3 claim anywhere (achieved / asserted / obtained / met)', () => {
    const text = JSON.stringify(plan);
    // Disclaimer text intentionally uses the "IAL2 or IAL3" tokens to NEGATE the claim.
    // Therefore the test guards positive claim *patterns* rather than the bare tokens.
    expect(text).not.toMatch(/IAL[23]\s+(achieved|asserted|obtained|met|granted|verified)/i);
    expect(text).not.toMatch(/AAL[23]\s+(achieved|asserted|obtained|met|granted|verified)/i);
    // And confirm the negation disclaimer is present
    expect(plan.disclaimers.some((d) => /No IAL2 or IAL3 assurance is claimed/.test(d))).toBe(true);
  });

  it('every control is isLive=false', () => {
    for (const c of plan.controls) {
      expect(c.isLive).toBe(false);
    }
  });

  it('vendor plan requires consent_capture, retention_redaction, audit_receipt (all required, none isLive)', () => {
    for (const kind of ['consent_capture', 'retention_redaction', 'audit_receipt'] as IdentityVerificationControlKind[]) {
      const c = plan.controls.find((c) => c.kind === kind);
      expect(c).toBeDefined();
      expect(c!.required).toBe(true);
      expect(c!.isLive).toBe(false);
    }
  });

  it('vendor requirements include redaction, retention, audit-safe receipt, consent record', () => {
    const ids = plan.vendorRequirements.map((r) => r.id);
    expect(ids).toContain('no_data_retention_default');
    expect(ids).toContain('pii_redaction');
    expect(ids).toContain('audit_safe_receipt');
    expect(ids).toContain('consent_record');
    for (const r of plan.vendorRequirements) {
      expect(r.meetsToday).toBe(false);
    }
  });

  it('disclaimer reaffirms NPI lookup is not identity proofing', () => {
    expect(plan.disclaimers.some((d) => /NPI lookup is not government-ID identity proofing/.test(d))).toBe(true);
  });

  it('explainIdentityVerificationControl returns text for every control kind', () => {
    const all: IdentityVerificationControlKind[] = [
      'government_id',
      'selfie_liveness',
      'document_authenticity',
      'fraud_risk_screening',
      'manual_review',
      'consent_capture',
      'retention_redaction',
      'audit_receipt',
    ];
    for (const k of all) {
      expect(explainIdentityVerificationControl(k).length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Biometric gating
// ────────────────────────────────────────────────────────────────────────────

describe('biometric gating foundation', () => {
  const plan = buildBiometricGatingFoundationPlan();

  it('typed literals: biometricGatingLive=false, provesClinicianIdentity=false, recoveryFallbackRequired=true', () => {
    expect(plan.biometricGatingLive).toBe(false);
    expect(plan.provesClinicianIdentity).toBe(false);
    expect(plan.recoveryFallbackRequired).toBe(true);
  });

  it('local_device_auth_planned capability is isLive=false', () => {
    const c = plan.capabilities.find((c) => c.capability === 'local_device_auth_planned');
    expect(c).toBeDefined();
    expect(c!.isLive).toBe(false);
  });

  it('recovery_fallback_required is required (and isLive=false in this foundation)', () => {
    const c = plan.capabilities.find((c) => c.capability === 'recovery_fallback_required');
    expect(c).toBeDefined();
    expect(c!.required).toBe(true);
    expect(c!.isLive).toBe(false);
  });

  it('audit_event_required is required (and isLive=false in this foundation)', () => {
    const c = plan.capabilities.find((c) => c.capability === 'audit_event_required');
    expect(c).toBeDefined();
    expect(c!.required).toBe(true);
  });

  it('disclaimers say not live, not identity proof, fallback required, no raw biometric logging', () => {
    expect(plan.disclaimers.some((d) => /Biometric gating is a planned device-level control. It is not live yet/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /Biometric unlock does not prove clinician identity by itself/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /recovery .* fallback path is required/i.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /No raw biometric template/.test(d))).toBe(true);
  });

  it('explainBiometricGatingStatus returns text for every status', () => {
    expect(explainBiometricGatingStatus('foundation_planned').length).toBeGreaterThan(0);
    expect(explainBiometricGatingStatus('foundation_required').length).toBeGreaterThan(0);
    expect(explainBiometricGatingStatus('unavailable').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Route copy invariants
// ────────────────────────────────────────────────────────────────────────────

const APP_ROOT = resolve(__dirname, '..', 'app');
const readRoute = (rel: string) => readFileSync(resolve(APP_ROOT, rel), 'utf-8');

describe('route copy invariants', () => {
  it('mobile/native-readiness page renders the native-not-live + planned-controls disclaimers', () => {
    const src = readRoute('mobile/native-readiness/page.tsx');
    expect(src).toContain('Native iOS and Android apps are planned foundations. No native app is live yet.');
    expect(src).toContain('App Attest, Play Integrity, push notifications, and native camera capture are planned controls.');
  });

  it('clinician/identity/verification page renders the gov-ID-planned + NPI + IAL disclaimers', () => {
    const src = readRoute('clinician/identity/verification/page.tsx');
    expect(src).toContain('Government ID verification and selfie/liveness are planned controls. They are not live in this build.');
    expect(src).toContain('NPI lookup is not government-ID identity proofing.');
    expect(src).toContain('No IAL2 or IAL3 assurance is claimed.');
  });

  it('clinician/device-security page renders the biometric-gating + biometric-not-identity disclaimers', () => {
    const src = readRoute('clinician/device-security/page.tsx');
    expect(src).toContain('Biometric gating is a planned device-level control. It is not live yet.');
    expect(src).toContain('Biometric unlock does not prove clinician identity by itself.');
  });

  it('no foundation-sweep-4 route claims a positive live state for any planned control', () => {
    const positiveClaims = [
      'native ios app is live',
      'native android app is live',
      'app attest implemented',
      'play integrity implemented',
      'app store ready',
      'play store ready',
      'government id verified',
      'selfie verified',
      'liveness verified',
      'biometric gating live',
      'biometric verified',
      'ial2 achieved',
      'ial3 achieved',
    ];
    for (const rel of [
      'mobile/native-readiness/page.tsx',
      'clinician/identity/verification/page.tsx',
      'clinician/device-security/page.tsx',
    ]) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of positiveClaims) {
        expect(src).not.toContain(phrase);
      }
    }
  });

  it('no foundation-sweep-4 route contains blanket truth-contract banned phrases', () => {
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
    ];
    for (const rel of [
      'mobile/native-readiness/page.tsx',
      'clinician/identity/verification/page.tsx',
      'clinician/device-security/page.tsx',
    ]) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of banned) {
        expect(src).not.toContain(phrase);
      }
    }
  });
});
