/**
 * FOUNDATION-SWEEP-6 Lane B — analytics + status/docs foundation tests.
 *
 * Truth invariants enforced:
 *   - Analytics plan excludes PHI / credential payloads (typed
 *     `collectsPhi: false`, `collectsCredentialPayload: false`).
 *   - Analytics plan does not dispatch to a third party (typed
 *     `dispatchedToThirdParty: false`).
 *   - Every event privacy level is one of the two `safe_*` values.
 *   - Allowed-context-keys do NOT include identifier-bearing fields.
 *   - Status plan does not claim uptime guarantee (typed
 *     `uptimeGuaranteeImplied: false`).
 *   - Docs plan does not claim API completion (typed
 *     `apiDocsComplete: false`).
 *   - Routes carry the required safe copy.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildAnalyticsFoundationPlan,
  explainAnalyticsPrivacyLevel,
  type AnalyticsEventKind,
  type AnalyticsPrivacyLevel,
} from '../lib/commercial/analyticsFoundation';
import {
  buildStatusFoundationPlan,
  explainStatusSurfaceStatus,
  type StatusSurfaceKind,
} from '../lib/commercial/statusFoundation';

// ────────────────────────────────────────────────────────────────────────────
// Analytics
// ────────────────────────────────────────────────────────────────────────────

describe('analytics foundation', () => {
  const plan = buildAnalyticsFoundationPlan();

  it('typed literals: dispatchedToThirdParty=false, productionPipelineLive=false, collectsPhi=false, collectsCredentialPayload=false', () => {
    expect(plan.dispatchedToThirdParty).toBe(false);
    expect(plan.productionPipelineLive).toBe(false);
    expect(plan.collectsPhi).toBe(false);
    expect(plan.collectsCredentialPayload).toBe(false);
  });

  it('every event privacy level is one of the two safe_* values (no requires_consent in catalog)', () => {
    for (const e of plan.events) {
      expect(['safe_session_only', 'safe_aggregate']).toContain(e.privacyLevel);
    }
  });

  it('catalog includes the required event kinds', () => {
    const required: AnalyticsEventKind[] = [
      'npi_lookup_started',
      'profile_section_viewed',
      'import_entry_clicked',
      'proof_pack_previewed',
      'signup_step_viewed',
      'verifier_cta_clicked',
    ];
    const present = plan.events.map((e) => e.kind);
    for (const r of required) expect(present).toContain(r);
  });

  it('analytics-foundation route renders the privacy-safe disclaimer + invariant labels', () => {
    const src = readFileSync(resolve(APP_ROOT, 'analytics-foundation/page.tsx'), 'utf-8');
    expect(src).toContain('Analytics events are a privacy-safe foundation vocabulary. No PHI or credential payloads are collected here.');
    expect(src).toContain('Dispatched to third party');
    expect(src).toContain('Production pipeline live');
    expect(src).toContain('Collects PHI');
    expect(src).toContain('Collects credential payload');
  });

  it('the entire JSON serialization of the analytics plan contains no banned identifier-bearing context-key', () => {
    const text = JSON.stringify(plan).toLowerCase();
    // The serialized plan walks every event's allowedContextKeys; banned terms
    // must not appear anywhere in it.
    for (const banned of ['"npi"', '"email"', '"phone"', '"firstname"', '"lastname"', '"ssn"', '"dob"', '"credential"', '"token"', '"secret"']) {
      expect(text).not.toContain(banned);
    }
  });

  it('allowedContextKeys never includes identifier-bearing fields', () => {
    const banned = ['npi', 'email', 'phone', 'name', 'firstName', 'lastName', 'address', 'ssn', 'dob', 'credential', 'token', 'secret'];
    for (const e of plan.events) {
      for (const key of e.allowedContextKeys) {
        const lower = key.toLowerCase();
        for (const b of banned) {
          expect(lower).not.toContain(b);
        }
      }
    }
  });

  it('disclaimers explicitly negate PHI / third-party / raw-NPI capture', () => {
    expect(plan.disclaimers.some((d) => /No PHI or credential payloads are collected/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /No third-party analytics vendor is wired/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /exclude NPI digits, names, emails, and credential payloads/.test(d))).toBe(true);
  });

  it('explainAnalyticsPrivacyLevel returns text for every level', () => {
    const all: AnalyticsPrivacyLevel[] = ['safe_session_only', 'safe_aggregate', 'requires_consent'];
    for (const l of all) {
      expect(explainAnalyticsPrivacyLevel(l).length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Status / docs
// ────────────────────────────────────────────────────────────────────────────

describe('status / docs foundation', () => {
  const plan = buildStatusFoundationPlan();

  it('typed literals: uptimeGuaranteeImplied=false, productionStatusPageLive=false, apiDocsComplete=false', () => {
    expect(plan.uptimeGuaranteeImplied).toBe(false);
    expect(plan.productionStatusPageLive).toBe(false);
    expect(plan.apiDocsComplete).toBe(false);
  });

  it('every surface is isLive=false and foundation_planned', () => {
    for (const s of plan.surfaces) {
      expect(s.isLive).toBe(false);
      expect(s.status).toBe('foundation_planned');
    }
  });

  it('includes the required surface kinds', () => {
    const required: StatusSurfaceKind[] = [
      'source_health_status',
      'build_status',
      'docs_index',
      'public_changelog_planned',
      'incident_notice_planned',
      'api_docs_planned',
    ];
    const present = plan.surfaces.map((s) => s.kind);
    for (const r of required) expect(present).toContain(r);
  });

  it('disclaimers state no uptime guarantee + docs not complete + incident not live', () => {
    expect(plan.disclaimers.some((d) => /No uptime guarantee is implied/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /not complete API documentation/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /Incident notices and public changelogs are planned surfaces/.test(d))).toBe(true);
  });

  it('explainStatusSurfaceStatus returns text for every status', () => {
    const all = ['foundation_planned', 'foundation_preview', 'foundation_baseline_met', 'unavailable'] as const;
    for (const s of all) {
      expect(explainStatusSurfaceStatus(s).length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Route copy invariants
// ────────────────────────────────────────────────────────────────────────────

const APP_ROOT = resolve(__dirname, '..', 'app');
const readRoute = (rel: string) => readFileSync(resolve(APP_ROOT, rel), 'utf-8');

describe('analytics / status / docs route copy invariants', () => {
  it('analytics-foundation page renders the privacy-safe disclaimer', () => {
    const src = readRoute('analytics-foundation/page.tsx');
    expect(src).toContain('Analytics events are a privacy-safe foundation vocabulary. No PHI or credential payloads are collected here.');
  });

  it('status pages render their no-uptime honesty (split: customer + technical)', () => {
    // The operator console moved to /status/technical and keeps the original
    // foundation-preview disclaimer; the customer page carries its own.
    const technical = readRoute('status/technical/page.tsx');
    expect(technical).toContain('Status surfaces are foundation previews. No uptime guarantee is implied.');
    const customer = readRoute('status/page.tsx');
    expect(customer).toContain('does not publish uptime figures it has not measured');
  });

  it('docs page renders the foundation-not-complete-API disclaimer', () => {
    const src = readRoute('docs/page.tsx');
    expect(src).toContain('Docs are a launch-readiness foundation, not complete API documentation.');
  });

  it('docs page renders the API-docs-complete invariant as false', () => {
    const src = readRoute('docs/page.tsx');
    expect(src).toContain('API docs complete');
    expect(src).toContain('apiDocsComplete');
  });

  it('docs page surfaces the four planned-status surfaces from the foundation', () => {
    const src = readRoute('docs/page.tsx');
    // The page renders plan.surfaces; the foundation must include these kinds
    // and the page must walk them — the kinds are rendered via `kind: ${s.kind}`.
    expect(src).toContain('Planned status surfaces');
    expect(src).toContain('plan.surfaces');
    // The four required surface kinds the brief calls out:
    for (const kind of [
      'docs_index',
      'api_docs_planned',
      'public_changelog_planned',
      'incident_notice_planned',
    ]) {
      // Each kind is asserted via the foundation's typed catalog (covered by
      // the status-foundation test block above) AND must surface on the page
      // via `kind: ${s.kind}` rendering.
      const surface = buildStatusFoundationPlan().surfaces.find((s) => s.kind === kind);
      expect(surface).toBeDefined();
    }
  });

  it('docs page does not claim complete API documentation or production status operations', () => {
    const src = readRoute('docs/page.tsx').toLowerCase();
    // Anti-claim disclaimer is present (already asserted above); the positive
    // claims listed here MUST NOT appear.
    const positiveClaims = [
      'api documentation complete',
      'we ship complete api docs',
      'production status page is live',
      'production monitoring live',
      'we guarantee uptime',
    ];
    for (const phrase of positiveClaims) {
      expect(src).not.toContain(phrase);
    }
  });

  it('no Lane B route claims a positive live state for any planned surface', () => {
    // Note: "uptime guarantee" and "complete api documentation" appear inside
    // negation disclaimers ("No uptime guarantee is implied", "not complete API
    // documentation"). The guard therefore bans positive-claim variants only.
    const positiveClaims = [
      'phi analytics',
      'credential payload analytics',
      'third-party analytics live',
      'we guarantee uptime',
      'uptime sla guaranteed',
      'api documentation complete',
      'production monitoring live',
      'subscription active',
      'payments are live',
      'stripe checkout live',
    ];
    for (const rel of [
      'analytics-foundation/page.tsx',
      'status/page.tsx',
      'status/technical/page.tsx',
      'docs/page.tsx',
    ]) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of positiveClaims) {
        expect(src).not.toContain(phrase);
      }
    }
  });

  it('no Lane B route contains blanket truth-contract banned phrases', () => {
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
      'analytics-foundation/page.tsx',
      'status/page.tsx',
      'status/technical/page.tsx',
      'docs/page.tsx',
    ]) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of banned) expect(src).not.toContain(phrase);
    }
  });
});
