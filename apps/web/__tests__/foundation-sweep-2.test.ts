/**
 * FOUNDATION-SWEEP-2 — identity / accessibility / import foundation tests.
 *
 * Truth invariants enforced:
 *   - NPI lookup is not identity proofing.
 *   - User-entered name + NPI does not prove identity.
 *   - Government ID and liveness are planned controls (isLive: false).
 *   - No status implies IAL2 / IAL3.
 *   - Accessibility checklist contains the required category set.
 *   - Checklist never claims WCAG AA complete.
 *   - Import entries label LinkedIn / Doximity / PubMed as planned or
 *     entry-only (never live).
 *   - Import error states are user-safe (no raw payload, no stack
 *     trace, no secret).
 *   - Provenance labels do not imply verification.
 *   - The clinician identity + import pages render the safe copy.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildIdentityProofingFoundationPolicy,
  evaluateClinicianNpiBindingReadiness,
  explainIdentityProofingStatus,
  type ClinicianNpiBindingStatus,
  type IdentityProofingStatus,
} from '../lib/identity/identityProofingPolicy';
import {
  buildAccessibilityFoundationChecklist,
  explainAccessibilityRequirement,
  getAccessibilityPhaseForRoute,
  type AccessibilityCategory,
} from '../lib/accessibility/accessibilityFoundation';
import {
  buildImportErrorState,
  buildImportFoundationEntries,
  explainImportIntegrationStatus,
  getImportProvenanceLabel,
  type ImportErrorKind,
  type ImportProvenanceStatus,
} from '../lib/import-export/importFoundation';

// ────────────────────────────────────────────────────────────────────────────
// Identity proofing
// ────────────────────────────────────────────────────────────────────────────

describe('identity proofing foundation', () => {
  const policy = buildIdentityProofingFoundationPolicy();

  it('NPI lookup is NOT identity proofing — disclaimer present', () => {
    expect(policy.disclaimers[0]).toMatch(/NPI lookup is not government-ID identity proofing/);
  });

  it('user-entered name + NPI does NOT prove identity', () => {
    const status: ClinicianNpiBindingStatus = evaluateClinicianNpiBindingReadiness({
      identifierResolved: true,
      selfAttestedName: true,
    });
    expect(status).toBe('foundation_ready');
    // foundation_ready is NOT verified
    expect(status).not.toContain('verified');
  });

  it('government ID and liveness are planned controls (isLive: false)', () => {
    const govId = policy.controls.find((c) => c.id === 'government_id');
    const liveness = policy.controls.find((c) => c.id === 'selfie_liveness');
    expect(govId).toBeDefined();
    expect(liveness).toBeDefined();
    expect(govId!.isLive).toBe(false);
    expect(liveness!.isLive).toBe(false);
  });

  it('NPI lookup and self-attested name are the only live controls', () => {
    const liveControls = policy.controls.filter((c) => c.isLive);
    expect(liveControls.map((c) => c.id).sort()).toEqual(['npi_lookup', 'self_attested_name']);
  });

  it('no IAL2 / IAL3 / AAL2 / AAL3 claim is produced anywhere in the policy', () => {
    const text = JSON.stringify(policy);
    expect(text).not.toMatch(/IAL2/);
    expect(text).not.toMatch(/IAL3/);
    expect(text).not.toMatch(/AAL2/);
    expect(text).not.toMatch(/AAL3/);
    // explicit disclaimer that this foundation does not assert any NIST identity assurance level
    expect(policy.disclaimers.some((d) => /does not assert any NIST 800-63 identity assurance level/.test(d))).toBe(true);
  });

  it('binding readiness is foundation_ready at most — never "verified"', () => {
    for (const input of [
      { identifierResolved: true, selfAttestedName: true },
      {
        identifierResolved: true,
        selfAttestedName: true,
        governmentIdVerified: true,
        livenessVerified: true,
      },
    ]) {
      const out = evaluateClinicianNpiBindingReadiness(input);
      expect(out).not.toMatch(/verified/);
      expect(out).toBe('foundation_ready');
    }
  });

  it('explainIdentityProofingStatus covers every status without fabricating IAL claims', () => {
    const allStatuses: IdentityProofingStatus[] = [
      'not_started',
      'policy_defined',
      'user_claimed',
      'source_candidate',
      'source_backed',
      'requires_government_id',
      'requires_liveness',
      'blocked',
      'unavailable',
    ];
    for (const status of allStatuses) {
      const out = explainIdentityProofingStatus(status);
      expect(out.length).toBeGreaterThan(0);
      expect(out).not.toMatch(/IAL2|IAL3/);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Accessibility
// ────────────────────────────────────────────────────────────────────────────

describe('accessibility foundation checklist', () => {
  const checklist = buildAccessibilityFoundationChecklist('/clinician/identity', []);

  it('contains every required category', () => {
    const required: AccessibilityCategory[] = [
      'semantic_headings',
      'form_labels',
      'help_error_text',
      'keyboard_navigation',
      'focus_visibility',
      'touch_targets',
      'contrast',
      'reduced_motion',
      'screen_reader_labels',
    ];
    const present = checklist.requirements.map((r) => r.category);
    for (const c of required) expect(present).toContain(c);
  });

  it('never claims WCAG AA complete', () => {
    const text = JSON.stringify(checklist);
    expect(text).not.toMatch(/WCAG AA complete/);
    expect(text).not.toMatch(/WCAG 2\.2 AA complete/);
    expect(checklist.disclaimer).toMatch(/baseline self-check/);
    expect(checklist.disclaimer).toMatch(/not a WCAG 2\.2 AA certification/);
  });

  it('phase is foundation_baseline_met only when every applicable finding is pass', () => {
    const allPass = getAccessibilityPhaseForRoute([
      { category: 'semantic_headings', status: 'pass', note: 'h1+h2 in order' },
      { category: 'form_labels', status: 'pass', note: 'every input labelled' },
    ]);
    expect(allPass).toBe('foundation_baseline_met');

    const mixed = getAccessibilityPhaseForRoute([
      { category: 'semantic_headings', status: 'pass', note: 'ok' },
      { category: 'contrast', status: 'partial', note: 'some surfaces' },
    ]);
    expect(mixed).toBe('foundation_in_progress');

    const empty = getAccessibilityPhaseForRoute([]);
    expect(empty).toBe('foundation_not_started');
  });

  it('explainAccessibilityRequirement returns a defined pass condition for every category', () => {
    const cats: AccessibilityCategory[] = [
      'semantic_headings',
      'form_labels',
      'help_error_text',
      'keyboard_navigation',
      'focus_visibility',
      'touch_targets',
      'contrast',
      'reduced_motion',
      'screen_reader_labels',
    ];
    for (const c of cats) {
      const req = explainAccessibilityRequirement(c);
      expect(req.passCondition.length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Import / export
// ────────────────────────────────────────────────────────────────────────────

describe('import / export foundation', () => {
  const entries = buildImportFoundationEntries();

  it('LinkedIn / Doximity import entries are planned (no live integration)', () => {
    const linkedin = entries.find((e) => e.kind === 'linkedin_import');
    const doximity = entries.find((e) => e.kind === 'doximity_import');
    expect(linkedin?.status).toBe('planned');
    expect(doximity?.status).toBe('planned');
  });

  it('PubMed import entry is entry-only (origin recorded; not verified)', () => {
    const pubmed = entries.find((e) => e.kind === 'pubmed_import');
    expect(pubmed?.status).toBe('entry_only');
  });

  it('no import entry is reported as live', () => {
    for (const e of entries) {
      expect(e.status).not.toBe('live');
    }
  });

  it('explainImportIntegrationStatus returns text for every status without claiming live for unimplemented integrations', () => {
    expect(explainImportIntegrationStatus('planned')).toMatch(/no live integration/i);
    expect(explainImportIntegrationStatus('entry_only')).toMatch(/Entry point only/);
    expect(explainImportIntegrationStatus('partial')).toMatch(/Partial/);
    expect(explainImportIntegrationStatus('live')).toMatch(/shipped and validated/);
  });

  it('import error state is user-safe — never includes raw payload, stack, or secret', () => {
    const samples: ImportErrorKind[] = [
      'unsupported_file_type',
      'file_too_large',
      'parse_failure',
      'integration_unavailable',
      'rate_limited',
      'transport_error',
      'validation_failed',
      'unknown',
    ];
    for (const kind of samples) {
      const err = buildImportErrorState({ kind });
      const text = JSON.stringify(err);
      expect(text.toLowerCase()).not.toContain('stack');
      expect(text.toLowerCase()).not.toContain('payload');
      expect(text.toLowerCase()).not.toContain('secret');
      expect(text.toLowerCase()).not.toContain('token');
      expect(text.length).toBeLessThanOrEqual(400);
      expect(err.userMessage.length).toBeGreaterThan(0);
      expect(err.remediation.length).toBeGreaterThan(0);
    }
  });

  it('unknown error kinds defensively map to the unknown template', () => {
    const err = buildImportErrorState({ kind: 'totally_made_up' });
    expect(err.kind).toBe('unknown');
  });

  it('provenance labels do not imply verification', () => {
    const labels: Record<ImportProvenanceStatus, string> = {
      self_attested: getImportProvenanceLabel('self_attested'),
      imported_candidate: getImportProvenanceLabel('imported_candidate'),
      source_backed: getImportProvenanceLabel('source_backed'),
      unknown: getImportProvenanceLabel('unknown'),
      conflict: getImportProvenanceLabel('conflict'),
    };
    expect(labels.self_attested).toMatch(/not verified/i);
    expect(labels.imported_candidate).toMatch(/not verified/i);
    // Even source_backed is described as a check having run, not a credential having been verified
    expect(labels.source_backed).toMatch(/source-of-record check/i);
    expect(labels.source_backed).not.toMatch(/verified credential/i);
    expect(labels.unknown).toMatch(/no data/i);
    expect(labels.conflict).toMatch(/disagree/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Route copy invariants (clinician/identity + clinician/import)
// ────────────────────────────────────────────────────────────────────────────

const ROUTE_DIR = resolve(__dirname, '..', 'app', 'clinician');
const readRoute = (rel: string) => readFileSync(resolve(ROUTE_DIR, rel), 'utf-8');

describe('clinician identity + import page copy invariants', () => {
  it('clinician/identity page renders the NPI-vs-identity-proofing disclaimer', () => {
    const src = readRoute('identity/page.tsx');
    expect(src).toContain('NPI lookup is not government-ID identity proofing.');
  });

  it('clinician/identity page does not claim live government ID or liveness verification', () => {
    const src = readRoute('identity/page.tsx').toLowerCase();
    expect(src).not.toContain('government id verified');
    expect(src).not.toContain('liveness verified');
    expect(src).not.toContain('biometric verified');
    expect(src).not.toMatch(/\bial2\b/);
    expect(src).not.toMatch(/\bial3\b/);
  });

  it('clinician/import page renders the imported-data-not-verified disclaimer', () => {
    const src = readRoute('import/page.tsx');
    expect(src).toContain(
      'Import entries may be planned or entry-only. Imported or uploaded data is not verified until source-backed evidence is attached.',
    );
  });

  it('clinician/import page does not claim LinkedIn / Doximity / PubMed are live', () => {
    const src = readRoute('import/page.tsx').toLowerCase();
    expect(src).not.toContain('linkedin import live');
    expect(src).not.toContain('doximity import live');
    expect(src).not.toContain('pubmed import live');
  });

  it('neither page contains blanket truth-contract banned phrases', () => {
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
      'wcag aa complete',
    ];
    for (const rel of ['identity/page.tsx', 'import/page.tsx']) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of banned) expect(src).not.toContain(phrase);
    }
  });
});
