/**
 * FOUNDATION-SWEEP-5 — import / publication / profile-layer tests.
 *
 * Truth invariants enforced:
 *   - LinkedIn import is planned/entry-only, not live.
 *   - Doximity import is planned/entry-only, not live.
 *   - PubMed import is candidate-only unless source-backed.
 *   - No import claims verification by default.
 *   - No scraping or credential collection is represented.
 *   - Publication candidates require source / person disambiguation.
 *   - Manual publications are user_entered (verified: false typed).
 *   - Profile layers do not verify credentials (typed literal).
 *   - Routes carry the required safe copy.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildProfessionalImportFoundationEntries,
  evaluateProfessionalImportReadiness,
  explainProfessionalImportStatus,
  PROFESSIONAL_IMPORT_DISCLAIMERS,
  type ProfessionalImportKind,
  type ProfessionalImportStatus,
} from '../lib/import-export/professionalImportFoundation';
import {
  buildResearchProfileFoundation,
  buildSamplePublicationCandidates,
  explainPublicationCandidateStatus,
  getResearchProfileReadiness,
  type PublicationCandidateStatus,
} from '../lib/research/publicationFoundation';
import {
  buildProfessionalProfileLayerPlan,
  explainProfessionalProfileLayer,
  type ProfessionalProfileLayerKind,
} from '../lib/clinician-profile/professionalProfileLayer';

// ────────────────────────────────────────────────────────────────────────────
// Professional import
// ────────────────────────────────────────────────────────────────────────────

describe('professional import foundation', () => {
  const entries = buildProfessionalImportFoundationEntries();

  it('LinkedIn import is planned / entry-only, never live', () => {
    const linkedin = entries.find((e) => e.kind === 'linkedin_profile');
    expect(linkedin).toBeDefined();
    expect(linkedin!.isLive).toBe(false);
    expect(linkedin!.status).toBe('planned');
  });

  it('Doximity import is planned / entry-only, never live', () => {
    const doximity = entries.find((e) => e.kind === 'doximity_profile');
    expect(doximity).toBeDefined();
    expect(doximity!.isLive).toBe(false);
    expect(doximity!.status).toBe('planned');
  });

  it('PubMed import is candidate-only unless source-backed', () => {
    const pubmed = entries.find((e) => e.kind === 'pubmed_publications');
    expect(pubmed).toBeDefined();
    expect(pubmed!.isLive).toBe(false);
    expect(pubmed!.status).toBe('candidate_ready');
    expect(pubmed!.requiredCapabilities).toContain('identity_disambiguation');
    expect(pubmed!.requiredCapabilities).toContain('author_match_required');
  });

  it('every import entry is isLive=false', () => {
    for (const e of entries) {
      expect(e.isLive).toBe(false);
    }
  });

  it('no import claims live integration anywhere', () => {
    const text = JSON.stringify(entries).toLowerCase();
    expect(text).not.toContain('linkedin import live');
    expect(text).not.toContain('doximity import live');
    expect(text).not.toContain('pubmed import live');
    expect(text).not.toContain('verified profile');
    expect(text).not.toContain('verified publication');
    expect(text).not.toContain('publications verified');
  });

  it('LinkedIn / Doximity require no_scraping + no_credential_collection capabilities', () => {
    for (const kind of ['linkedin_profile', 'doximity_profile'] as ProfessionalImportKind[]) {
      const e = entries.find((x) => x.kind === kind);
      expect(e!.requiredCapabilities).toContain('no_scraping');
      expect(e!.requiredCapabilities).toContain('no_credential_collection');
    }
  });

  it('disclaimers explicitly negate scraping + credential collection', () => {
    expect(PROFESSIONAL_IMPORT_DISCLAIMERS.some((d) => /No scraping or credential collection/.test(d))).toBe(true);
    expect(PROFESSIONAL_IMPORT_DISCLAIMERS.some((d) => /LinkedIn and Doximity imports are planned entry points/.test(d))).toBe(true);
  });

  it('readiness never returns productionReady=true', () => {
    for (const kind of ['linkedin_profile', 'doximity_profile', 'pubmed_publications', 'manual_cv', 'csv_roster'] as ProfessionalImportKind[]) {
      const r = evaluateProfessionalImportReadiness({
        kind,
        hasIdentityDisambiguation: true,
        hasConsentRecord: true,
        sourceMatchAttached: true,
      });
      expect(r.productionReady).toBe(false);
    }
  });

  it('PubMed readiness upgrades to source_candidate when source match is attached', () => {
    const r = evaluateProfessionalImportReadiness({
      kind: 'pubmed_publications',
      hasIdentityDisambiguation: true,
      hasConsentRecord: true,
      sourceMatchAttached: true,
    });
    expect(r.status).toBe('source_candidate');
  });

  it('explainProfessionalImportStatus returns text for every status', () => {
    const all: ProfessionalImportStatus[] = [
      'planned',
      'entry_only',
      'candidate_ready',
      'source_candidate',
      'source_backed',
      'unavailable',
      'blocked',
    ];
    for (const s of all) {
      expect(explainProfessionalImportStatus(s).length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Publication / research foundation
// ────────────────────────────────────────────────────────────────────────────

describe('publication / research foundation', () => {
  const foundation = buildResearchProfileFoundation();
  const candidates = buildSamplePublicationCandidates();

  it('typed literals: pubmedCandidatesVerifiedByDefault=false, sourceBackedVerificationImplemented=false', () => {
    expect(foundation.pubmedCandidatesVerifiedByDefault).toBe(false);
    expect(foundation.sourceBackedVerificationImplemented).toBe(false);
  });

  it('every candidate has typed verified=false', () => {
    for (const c of candidates) {
      expect(c.verified).toBe(false);
    }
  });

  it('PubMed candidate requires disambiguation', () => {
    const pubmed = candidates.find((c) => c.source === 'PubMed');
    expect(pubmed).toBeDefined();
    expect(pubmed!.requiresDisambiguation).toBe(true);
    expect(pubmed!.status).toBe('candidate_unmatched');
  });

  it('manual publications are user_entered', () => {
    const manual = candidates.find((c) => c.source === 'manual_entry');
    expect(manual).toBeDefined();
    expect(manual!.status).toBe('user_entered');
    expect(manual!.verified).toBe(false);
  });

  it('readiness reports verifiedCount=0', () => {
    const r = getResearchProfileReadiness(candidates);
    expect(r.verifiedCount).toBe(0);
  });

  it('foundation supports PubMed / ORCID / Crossref / OpenAlex / manual_entry source kinds', () => {
    expect(foundation.supportedSources).toEqual(['PubMed', 'ORCID', 'Crossref', 'OpenAlex', 'manual_entry']);
  });

  it('disclaimer reaffirms candidate-until-source-backed-matching for PubMed', () => {
    expect(foundation.disclaimers.some((d) => /PubMed entries are publication candidates/.test(d))).toBe(true);
    expect(foundation.disclaimers.some((d) => /disambiguation/.test(d))).toBe(true);
  });

  it('explainPublicationCandidateStatus returns text for every status', () => {
    const all: PublicationCandidateStatus[] = [
      'candidate_unmatched',
      'candidate_matched_pending_review',
      'source_backed_pending_verification',
      'user_entered',
      'unknown',
    ];
    for (const s of all) {
      expect(explainPublicationCandidateStatus(s).length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Professional profile layer
// ────────────────────────────────────────────────────────────────────────────

describe('professional profile layer foundation', () => {
  const plan = buildProfessionalProfileLayerPlan();

  it('typed literal: verifiesCredentials=false at plan level', () => {
    expect(plan.verifiesCredentials).toBe(false);
  });

  it('every layer is verifiesCredentials=false', () => {
    for (const l of plan.layers) {
      expect(l.verifiesCredentials).toBe(false);
    }
  });

  it('includes the required layer set', () => {
    const required: ProfessionalProfileLayerKind[] = [
      'linkedin_style',
      'doximity_style',
      'research_publication',
      'employer_affiliation',
      'credential_readiness',
    ];
    const present = plan.layers.map((l) => l.layer);
    for (const r of required) expect(present).toContain(r);
  });

  it('every sample signal has a non-empty provenance value', () => {
    for (const s of plan.sampleSignals) {
      expect(s.provenance.length).toBeGreaterThan(0);
    }
  });

  it('disclaimers state layers do not verify credentials and LinkedIn/Doximity styles are not integrations', () => {
    expect(plan.disclaimers.some((d) => /Profile-layer signals organize information; they do not verify credentials/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /LinkedIn-style and Doximity-style are presentation concepts, not integrations/.test(d))).toBe(true);
  });

  it('explainProfessionalProfileLayer returns text for every layer kind', () => {
    const all: ProfessionalProfileLayerKind[] = [
      'linkedin_style',
      'doximity_style',
      'research_publication',
      'employer_affiliation',
      'credential_readiness',
    ];
    for (const k of all) {
      expect(explainProfessionalProfileLayer(k).length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Route copy invariants
// ────────────────────────────────────────────────────────────────────────────

const APP_ROOT = resolve(__dirname, '..', 'app');
const readRoute = (rel: string) => readFileSync(resolve(APP_ROOT, rel), 'utf-8');

describe('route copy invariants', () => {
  it('clinician/import/professional renders all 3 required disclaimers', () => {
    const src = readRoute('clinician/import/professional/page.tsx');
    expect(src).toContain('LinkedIn and Doximity imports are planned entry points, not live integrations.');
    expect(src).toContain('PubMed entries are publication candidates until source-backed matching is attached.');
    expect(src).toContain('No scraping or credential collection is performed.');
  });

  it('clinician/research renders the candidate-until-source-backed disclaimer', () => {
    const src = readRoute('clinician/research/page.tsx');
    expect(src).toContain('PubMed entries are publication candidates until source-backed matching is attached.');
  });

  it('clinician/profile-layers renders the does-not-verify disclaimer', () => {
    const src = readRoute('clinician/profile-layers/page.tsx');
    expect(src).toContain('Profile-layer signals organize information; they do not verify credentials by themselves.');
  });

  it('no foundation-sweep-5 route claims a positive live state for any planned import', () => {
    // Note: "credential collection" appears in the disclaimer "No scraping or
    // credential collection is performed" — that's an anti-claim. The guard
    // therefore bans positive-claim variants only.
    const positiveClaims = [
      'linkedin import live',
      'doximity import live',
      'pubmed import live',
      'linkedin verified',
      'doximity verified',
      'publications verified',
      'verified profile',
      'verified publication',
      'scrape linkedin',
      'scrape doximity',
      'credential collection performed',
      'we collect credentials',
    ];
    for (const rel of [
      'clinician/import/professional/page.tsx',
      'clinician/research/page.tsx',
      'clinician/profile-layers/page.tsx',
    ]) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of positiveClaims) {
        expect(src).not.toContain(phrase);
      }
    }
  });

  it('no foundation-sweep-5 route contains blanket truth-contract banned phrases', () => {
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
      'clinician/import/professional/page.tsx',
      'clinician/research/page.tsx',
      'clinician/profile-layers/page.tsx',
    ]) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of banned) expect(src).not.toContain(phrase);
    }
  });
});
