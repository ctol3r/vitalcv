/**
 * FOUNDATION-SWEEP-2 — accessibility / import foundation tests.
 *
 * Truth invariants enforced:
 *   - Accessibility checklist contains the required category set.
 *   - Checklist never claims WCAG AA complete.
 *   - Import entries label LinkedIn / Doximity / PubMed as planned or
 *     entry-only (never live).
 *   - Import error states are user-safe (no raw payload, no stack
 *     trace, no secret).
 *   - Provenance labels do not imply verification.
 *
 * The identity-proofing blocks and the clinician/identity +
 * clinician/import route-copy invariants left with the routes themselves:
 * the 2026-08-07 orphaned-route retirement deleted those foundation pages
 * and their spec modules (headerless-routes disposition, bucket D), so the
 * claims those guards policed no longer ship anywhere. The import and
 * accessibility modules below remain live and remain guarded.
 */

import { describe, expect, it } from 'vitest';

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
// Accessibility
// ────────────────────────────────────────────────────────────────────────────

describe('accessibility foundation checklist', () => {
  // Route key is a label input only; use a live surface now that the
  // retired /clinician/identity page is gone.
  const checklist = buildAccessibilityFoundationChecklist('/profile/activate', []);

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
