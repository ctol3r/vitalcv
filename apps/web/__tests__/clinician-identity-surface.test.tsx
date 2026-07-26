/**
 * WAVE-2G — clinician identity surface contract.
 *
 * Pins the provenance honesty of /clinician/identity:
 *   - the personal record derives from real session + PersonProfile
 *     inputs (the hardcoded sample binding is gone),
 *   - NPPES-copied values are labeled stored copies, never proofed
 *     identity,
 *   - missing data is UNKNOWN/unverified, and
 *   - the page keeps its truth-contract strings.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RoleProvider } from '@/components/auth/RoleContext';
import { ClinicianIdentityPanel, PanelBody } from '@/components/identity/ClinicianIdentityPanel';
import {
  buildClinicianIdentitySurface,
  explainNpiBindingStatus,
  type ClinicianIdentitySurfaceModel,
} from '@/lib/identity/clinicianIdentitySurface';
import type { ClinicianNpiBindingStatus } from '@/lib/identity/identityProofingPolicy';
import { isCoherentProvenance } from '@/lib/clinician-profile/profileTypes';
import { PROVENANCE_META } from '@/lib/profile/provenance';
import type { WorkspacePersonProfile } from '@/types/workspace';

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
}));

function profileFixture(
  overrides: Partial<WorkspacePersonProfile> = {},
): WorkspacePersonProfile {
  return {
    id: 'pp_1',
    userId: 'user_1',
    npi: '1033806195',
    npiType: 'TYPE_1',
    firstName: 'Connor',
    lastName: 'Kilch',
    specialty: 'Family Medicine',
    stateOfPractice: 'MI',
    workAuthStatus: null,
    resumeUrl: null,
    linkedinUrl: null,
    portfolioUrl: null,
    completeness: 30,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function allFields(model: ClinicianIdentitySurfaceModel) {
  return model.sections.flatMap((section) => section.fields);
}

function fieldById(model: ClinicianIdentitySurfaceModel, id: string) {
  const field = allFields(model).find((candidate) => candidate.id === id);
  if (!field) throw new Error(`missing field: ${id}`);
  return field;
}

describe('buildClinicianIdentitySurface', () => {
  it('signed-out: policy-only view with a sign-in gap and nothing source-backed', () => {
    const model = buildClinicianIdentitySurface({
      isSignedIn: false,
      accountEmail: null,
      personProfile: null,
    });

    expect(model.audience).toBe('signed_out');
    expect(model.bindingStatus).toBe('unbound');
    expect(model.gaps.map((gap) => gap.id)).toEqual(['sign_in']);
    expect(model.gaps[0].href).toBe('/sign-in');
    for (const field of allFields(model)) {
      expect(field.confidence).not.toBe('source-backed');
      expect(field.value).toBeNull();
      expect(field.provenance).toBe('UNKNOWN');
    }
  });

  it('signed-in without an NPI binding: unbound + claim gap routed to /onboarding', () => {
    const model = buildClinicianIdentitySurface({
      isSignedIn: true,
      accountEmail: 'doc@example.com',
      personProfile: null,
    });

    expect(model.audience).toBe('signed_in');
    expect(model.bindingStatus).toBe('unbound');
    const claimGap = model.gaps.find((gap) => gap.id === 'claim_npi');
    expect(claimGap?.href).toBe('/onboarding');
    // Account identity is present but never source-backed.
    expect(fieldById(model, 'account_email').value).toBe('doc@example.com');
    expect(fieldById(model, 'account_email').confidence).toBe('self-attested');
    // With no bound NPI, nothing may present as source-backed.
    for (const field of allFields(model)) {
      expect(field.confidence).not.toBe('source-backed');
    }
  });

  it('signed-in with a claimed NPI: foundation_ready with NPPES stored-copy labels', () => {
    const model = buildClinicianIdentitySurface({
      isSignedIn: true,
      accountEmail: 'doc@example.com',
      personProfile: profileFixture(),
    });

    expect(model.bindingStatus).toBe('foundation_ready');
    expect(model.gaps.find((gap) => gap.id === 'claim_npi')).toBeUndefined();

    const npiField = fieldById(model, 'npi');
    expect(npiField.value).toBe('1033806195');
    expect(npiField.provenance).toBe('VERIFIED');
    expect(npiField.confidence).toBe('source-backed');
    expect(npiField.sourceLabel).toContain('NPPES');
    expect(npiField.changePolicy).toBe('source_of_record');

    const nameField = fieldById(model, 'name_on_file');
    expect(nameField.value).toBe('Connor Kilch');
    expect(nameField.limitationNote).toContain('Stored copy');
    expect(nameField.changePolicy).toBe('source_of_record');

    expect(fieldById(model, 'npi_type').value).toBe('Individual (Type 1)');
    expect(fieldById(model, 'specialty').changePolicy).toBe('source_of_record');
    expect(fieldById(model, 'state_of_practice').changePolicy).toBe('source_of_record');
  });

  it('omits gov-id/liveness evaluator inputs so an unproofed claim is never demoted to gov_id_required', () => {
    const model = buildClinicianIdentitySurface({
      isSignedIn: true,
      accountEmail: null,
      personProfile: profileFixture(),
    });

    // Passing governmentIdVerified: false into the policy evaluator
    // would assert a failed check that never ran; the surface must not.
    expect(model.bindingStatus).toBe('foundation_ready');
    expect(model.bindingStatus).not.toBe('gov_id_required');
    expect(model.bindingStatus).not.toBe('liveness_required');
  });

  it('NPI without a stored name stays self_attested and surfaces a refresh gap', () => {
    const model = buildClinicianIdentitySurface({
      isSignedIn: true,
      accountEmail: null,
      personProfile: profileFixture({ firstName: null, lastName: null }),
    });

    expect(model.bindingStatus).toBe('self_attested');
    const gap = model.gaps.find((candidate) => candidate.id === 'name_missing');
    expect(gap?.href).toBe('/onboarding');
    expect(fieldById(model, 'name_on_file').value).toBeNull();
    expect(fieldById(model, 'name_on_file').provenance).toBe('UNKNOWN');
  });

  it('a profile without an NPI never labels identity fields source-backed', () => {
    const model = buildClinicianIdentitySurface({
      isSignedIn: true,
      accountEmail: null,
      personProfile: profileFixture({ npi: null, npiType: null }),
    });

    const nameField = fieldById(model, 'name_on_file');
    expect(nameField.provenance).toBe('USER_ENTERED');
    expect(nameField.confidence).toBe('self-attested');
    for (const field of allFields(model)) {
      expect(field.confidence).not.toBe('source-backed');
    }
  });

  it('missing values normalize to UNKNOWN + unverified and every field stays coherent', () => {
    const models = [
      buildClinicianIdentitySurface({ isSignedIn: false, accountEmail: null, personProfile: null }),
      buildClinicianIdentitySurface({ isSignedIn: true, accountEmail: null, personProfile: null }),
      buildClinicianIdentitySurface({
        isSignedIn: true,
        accountEmail: 'doc@example.com',
        personProfile: profileFixture({ workAuthStatus: null, specialty: null }),
      }),
    ];

    for (const model of models) {
      for (const field of allFields(model)) {
        expect(isCoherentProvenance(field.provenance, field.confidence)).toBe(true);
        if (field.value === null) {
          expect(field.provenance).toBe('UNKNOWN');
          expect(field.confidence).toBe('unverified');
        }
      }
    }

    const workAuth = fieldById(models[2], 'work_auth_status');
    expect(workAuth.provenance).toBe('UNKNOWN');
    expect(workAuth.confidence).toBe('unverified');
    expect(workAuth.changePolicy).toBe('editable_profile');
  });

  it('never renders the bare status label "Verified" and explains every binding status', () => {
    const model = buildClinicianIdentitySurface({
      isSignedIn: true,
      accountEmail: 'doc@example.com',
      personProfile: profileFixture(),
    });

    for (const field of allFields(model)) {
      expect(PROVENANCE_META[field.provenance].label.toLowerCase()).not.toBe('verified');
    }

    const statuses: ClinicianNpiBindingStatus[] = [
      'unbound',
      'self_attested',
      'foundation_ready',
      'gov_id_required',
      'liveness_required',
      'unavailable',
    ];
    for (const status of statuses) {
      const explanation = explainNpiBindingStatus(status);
      expect(explanation.length).toBeGreaterThan(20);
      expect(explanation.toLowerCase()).not.toMatch(/^verified\b/);
    }
    expect(explainNpiBindingStatus('foundation_ready')).toContain(
      'NPI lookup is not government-ID identity proofing',
    );
  });
});

describe('ClinicianIdentityPanel (static render, Clerk disabled)', () => {
  it('renders the signed-out record shell with a sign-in path', () => {
    const markup = renderToStaticMarkup(
      <RoleProvider initialUserId={null} initialClerkRole={null}>
        <ClinicianIdentityPanel />
      </RoleProvider>,
    );

    expect(markup).toContain('Your identity record');
    expect(markup).toContain('/sign-in');
    expect(markup).not.toContain('foundation_ready');
  });

  it('renders the signed-in record with binding status, badges, and change policies', () => {
    const markup = renderToStaticMarkup(
      <PanelBody
        isSignedIn
        accountEmail="doc@example.com"
        personProfile={profileFixture()}
        onRefresh={async () => {}}
      />,
    );

    expect(markup).toContain('foundation_ready');
    expect(markup).toContain('Connor Kilch');
    expect(markup).toContain('1033806195');
    expect(markup).toContain('NPPES');
    expect(markup).toContain('Source-confirmed');
    expect(markup).toContain('Requires source-of-record correction');
    expect(markup).toContain('Reload record');
    expect(markup).not.toContain('>Verified<');
  });
});

describe('/clinician/identity page copy invariants', () => {
  const pagePath = resolve(__dirname, '..', 'app', 'clinician', 'identity', 'page.tsx');
  const panelPath = resolve(__dirname, '..', 'components', 'identity', 'ClinicianIdentityPanel.tsx');
  const libPath = resolve(__dirname, '..', 'lib', 'identity', 'clinicianIdentitySurface.ts');
  const pageSrc = readFileSync(pagePath, 'utf-8');

  it('keeps the NPI-vs-identity-proofing disclaimer and mounts the personal record panel', () => {
    expect(pageSrc).toContain('NPI lookup is not government-ID identity proofing.');
    expect(pageSrc).toContain('ClinicianIdentityPanel');
  });

  it('no longer renders a hardcoded sample binding', () => {
    expect(pageSrc).not.toContain('Sample binding');
    expect(pageSrc).not.toContain('sampleBinding');
  });

  it('links the claim flow, verification policy, profile, and readiness surfaces', () => {
    for (const href of ['/onboarding', '/clinician/identity/verification', '/clinician/profile', '/holder/readiness']) {
      expect(pageSrc).toContain(href);
    }
  });

  it('page, panel, and surface lib avoid proofing overclaims and banned phrases', () => {
    const banned = [
      'guaranteed verification',
      'instant credentialing',
      'complete credentialing',
      'legally accepted',
      'risk transferred',
      'hipaa compliant',
      'soc2 certified',
      'government id verified',
      'liveness verified',
      'biometric verified',
      'automatically verified',
    ];
    for (const path of [pagePath, panelPath, libPath]) {
      const src = readFileSync(path, 'utf-8').toLowerCase();
      for (const phrase of banned) expect(src).not.toContain(phrase);
      expect(src).not.toMatch(/\bial2\b/);
      expect(src).not.toMatch(/\bial3\b/);
    }
  });
});
