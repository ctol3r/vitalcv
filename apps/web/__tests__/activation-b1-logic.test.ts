/**
 * The B1 activation logic — Wave 1076.
 *
 * Everything the surface decides, decided here where it can be tested without
 * a browser: which truth label a value gets, what a missing field is told to
 * mean, what the Readiness Planner says next, and how the NPI survives the trip
 * through sign-in.
 *
 * The recurring theme in these assertions is REFUSAL. Most of them exist to pin
 * something the product must never say — no bare "Verified", no readiness
 * score, no step that lets VitalCV take credit for a decision an employer or a
 * licensing board makes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activationPath,
  clearPendingNpi,
  readPendingNpi,
  rememberPendingNpi,
  resolveWorkingNpi,
  signInHref,
} from '@/lib/activation/pendingNpi';
import { guidanceForSpec, missingFieldGuidance } from '@/lib/activation/fieldGuidance';
import { buildPreview, PREVIEW_DISCLOSURES } from '@/lib/activation/preview';
import { CONTROLLER_LABEL, MAX_PLANNER_STEPS, planNextSteps } from '@/lib/activation/readinessPlanner';
import { editedFromPublicSourceNote, truthLabel } from '@/lib/activation/truthLabels';
import type { ProfileFieldSpec, ProfileView } from '@/lib/activation/profileView';

const NPI = '1003000126';

const SPECS: ProfileFieldSpec[] = [
  { key: 'fullName', label: 'Name', supports: 'Identifies the profile.', origin: 'public_source_correctable', required: true, freeText: true },
  { key: 'credential', label: 'Credential', supports: 'Employer filter.', origin: 'public_source_correctable', required: true, freeText: true },
  { key: 'specialty', label: 'Specialty', supports: 'Role matching.', origin: 'public_source_correctable', required: true, freeText: true },
  { key: 'practiceState', label: 'Practice location', supports: 'Role matching.', origin: 'public_source_correctable', required: true, freeText: false },
  { key: 'licensedStates', label: 'States you are licensed in', supports: 'Cross-state matching.', origin: 'public_source_correctable', required: false, freeText: false },
  { key: 'preferredStates', label: 'Where you want to work', supports: 'Role relevance.', origin: 'clinician_only', required: false, freeText: false },
  { key: 'workArrangement', label: 'Work arrangement', supports: 'Role relevance.', origin: 'clinician_only', required: false, freeText: false },
  { key: 'contactEmail', label: 'Contact email', supports: 'A reply path.', origin: 'clinician_only', required: true, freeText: true },
];

function view(over: Partial<ProfileView> = {}): ProfileView {
  return {
    npi: NPI,
    state: 'resolved',
    disclosure: 'Information found for this NPI. This does not confirm it is yours.',
    fields: [],
    missingRequired: [],
    reviewedAt: null,
    sharingConfirmedAt: null,
    savedAt: null,
    activatedAt: null,
    permissions: {
      reusableProfile: false,
      opportunityDiscovery: false,
      selfAttestedSharing: false,
      privateCredentialHoldings: false,
    },
    fieldSpecs: SPECS,
    ...over,
  };
}

/** An activated profile with everything required present. */
function activated(over: Partial<ProfileView> = {}): ProfileView {
  return view({
    state: 'profile_saved',
    disclosure: 'Your profile is saved and reusable.',
    fields: [
      { key: 'fullName', value: 'JEAN ABBOTT', truthClass: 'public_source', source: 'NPPES' },
      { key: 'specialty', value: 'Emergency Medicine', truthClass: 'public_source', source: 'NPPES' },
      { key: 'contactEmail', value: 'jean@example.com', truthClass: 'clinician_provided' },
    ],
    reviewedAt: '2026-08-05T00:00:00.000Z',
    sharingConfirmedAt: '2026-08-05T00:00:00.000Z',
    savedAt: '2026-08-05T00:00:00.000Z',
    activatedAt: '2026-08-05T00:00:00.000Z',
    permissions: {
      reusableProfile: true,
      opportunityDiscovery: true,
      selfAttestedSharing: true,
      privateCredentialHoldings: false,
    },
    ...over,
  });
}

describe('truth labels — four classes, never one badge', () => {
  it('never renders a bare "Verified" for any class', () => {
    for (const c of ['public_source', 'clinician_provided', 'ownership_verified', 'employer_reviewed'] as const) {
      expect(truthLabel(c).label.trim()).not.toBe('Verified');
    }
  });

  it('gives every class a distinct label', () => {
    const labels = (['public_source', 'clinician_provided', 'ownership_verified', 'employer_reviewed'] as const).map(
      (c) => truthLabel(c).label,
    );
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('names the registry that answered', () => {
    expect(truthLabel('public_source', 'NPPES').label).toBe('Found in NPPES');
  });

  it('falls back to a truthful generic when no registry was recorded', () => {
    expect(truthLabel('public_source').label).toBe('Found in a public source');
  });

  it('labels a clinician value as theirs, in plain words', () => {
    expect(truthLabel('clinician_provided').label).toBe('Added or changed by you');
  });

  it('says a public-source value does not prove ownership', () => {
    expect(truthLabel('public_source', 'NPPES').meaning).toContain('not confirmation that the NPI is yours');
  });

  it('says a clinician-provided value was not checked against a source', () => {
    expect(truthLabel('clinician_provided').meaning).toContain('has not checked it');
  });

  it('says identity confirmation is not credential verification', () => {
    expect(truthLabel('ownership_verified').meaning).toContain('does not check any individual credential');
  });

  it('says an employer opening a profile is not approval', () => {
    expect(truthLabel('employer_reviewed').meaning).toContain('not approval');
  });

  it('explains that an edit preserves the original public observation', () => {
    const note = editedFromPublicSourceNote('NPPES');
    expect(note).toContain('NPPES');
    expect(note).toContain('kept');
    // Said without teaching anyone the word "snapshot" or "column".
    expect(note.toLowerCase()).not.toContain('snapshot');
    expect(note.toLowerCase()).not.toContain('database');
  });
});

describe('missing-field guidance — never just a red field', () => {
  it('explains what is missing, and what it supports, for every required field', () => {
    const v = view({ missingRequired: ['contactEmail', 'credential'] });
    const guidance = missingFieldGuidance(v);

    expect(guidance).toHaveLength(2);
    for (const g of guidance) {
      expect(g.ask.length).toBeGreaterThan(0);
      // A sentence, not a label — the requirement is an explanation.
      expect(g.why.split(' ').length).toBeGreaterThan(6);
    }
  });

  it('gives the contact-email guidance the decision names', () => {
    const g = missingFieldGuidance(view({ missingRequired: ['contactEmail'] }))[0];
    expect(g.ask).toBe('Add a contact email');
    expect(g.why).toContain('employer can respond when you choose to share');
  });

  it('follows the server, not its own idea of what is missing', () => {
    // The server is the only thing that decides completeness — it is the same
    // code that refuses an incomplete save.
    expect(missingFieldGuidance(view({ missingRequired: [] }))).toEqual([]);
    expect(missingFieldGuidance(view({ missingRequired: ['specialty'] }))).toHaveLength(1);
  });

  it('falls back to the registry wording for a field it has never heard of', () => {
    const invented: ProfileFieldSpec = {
      key: 'dea', label: 'DEA number', supports: 'Prescribing roles require it.',
      origin: 'clinician_only', required: true, freeText: true,
    };
    const g = guidanceForSpec(invented);
    expect(g.ask).toBe('Add dea number');
    // A field added on the server alone still explains itself.
    expect(g.why).toBe('Prescribing roles require it.');
  });

  it('still says something useful if a key arrives with no spec', () => {
    const g = missingFieldGuidance(view({ missingRequired: ['ghost'], fieldSpecs: [] }))[0];
    expect(g.why).toContain('needed before the profile can be saved');
  });
});

describe('the anonymous preview', () => {
  const boot = { firstName: 'JEAN', lastName: 'ABBOTT', specialty: 'Emergency Medicine', state: 'CO', npiType: 'TYPE_1', identitySource: 'NPPES_API' };

  it('shows what the registry returned', () => {
    const out = buildPreview(NPI, boot);
    expect(out.kind).toBe('individual');
    if (out.kind !== 'individual') return;
    expect(out.items.map((i) => i.value)).toEqual(['JEAN ABBOTT', 'Emergency Medicine', 'CO']);
    expect(out.source).toBe('NPPES');
  });

  it('states the source, the ownership limit, and the right to correct', () => {
    const all = PREVIEW_DISCLOSURES.join(' ');
    expect(all).toContain('NPPES');
    expect(all).toContain('does not confirm it is yours');
    expect(all).toContain('correct');
  });

  it('refuses a Type-2 organization NPI', () => {
    expect(buildPreview(NPI, { ...boot, npiType: 'TYPE_2' }).kind).toBe('organization');
  });

  it('does not claim a find when the registry did not answer', () => {
    expect(buildPreview(NPI, { ...boot, identitySource: 'UNAVAILABLE' }).kind).toBe('no_answer');
    expect(buildPreview(NPI, null).kind).toBe('no_answer');
  });

  it('does not render an empty card under a heading that claims a find', () => {
    expect(buildPreview(NPI, { npiType: 'TYPE_1', identitySource: 'NPPES_API' }).kind).toBe('no_answer');
  });

  it('omits fields the registry did not return rather than showing blanks', () => {
    const out = buildPreview(NPI, { firstName: 'JEAN', lastName: 'ABBOTT', npiType: 'TYPE_1', identitySource: 'NPPES_API' });
    if (out.kind !== 'individual') throw new Error('expected individual');
    expect(out.items).toHaveLength(1);
  });
});

describe('the Readiness Planner', () => {
  it('says nothing before the server has activated the profile', () => {
    expect(planNextSteps(view())).toEqual([]);
    // Reviewed and saved but not yet activated is still not activated.
    expect(planNextSteps(view({ reviewedAt: 'x', savedAt: 'x' }))).toEqual([]);
  });

  it('leads with the reason the clinician came', () => {
    expect(planNextSteps(activated())[0].id).toBe('review_opportunities');
  });

  it('is bounded', () => {
    expect(planNextSteps(activated()).length).toBeLessThanOrEqual(MAX_PLANNER_STEPS);
  });

  it('is deterministic — the same profile gives the same plan', () => {
    expect(planNextSteps(activated())).toEqual(planNextSteps(activated()));
  });

  it('answers all four questions for every step', () => {
    for (const step of planNextSteps(activated())) {
      expect(step.action.length).toBeGreaterThan(0);
      expect(step.why.length).toBeGreaterThan(0);
      expect(step.vitalcvRole).toMatch(/^(does_it|helps|cannot)$/);
      expect(CONTROLLER_LABEL[step.controlledBy]).toBeDefined();
      expect(step.vitalcvNote.length).toBeGreaterThan(0);
    }
  });

  it('asks for licensed states only while they are missing', () => {
    const ids = planNextSteps(activated()).map((s) => s.id);
    expect(ids).toContain('add_licensed_states');

    const withStates = activated({
      fields: [...activated().fields, { key: 'licensedStates', value: ['CO', 'TX'], truthClass: 'clinician_provided' }],
    });
    expect(planNextSteps(withStates).map((s) => s.id)).not.toContain('add_licensed_states');
  });

  it('treats an empty list as missing, not as answered', () => {
    const empty = activated({
      fields: [...activated().fields, { key: 'licensedStates', value: [], truthClass: 'clinician_provided' }],
    });
    expect(planNextSteps(empty).map((s) => s.id)).toContain('add_licensed_states');
  });

  it('offers ownership verification while private holdings are locked, and says who decides', () => {
    const step = planNextSteps(
      activated({
        fields: [
          ...activated().fields,
          { key: 'licensedStates', value: ['CO'], truthClass: 'clinician_provided' },
          { key: 'preferredStates', value: ['CO'], truthClass: 'clinician_provided' },
          { key: 'workArrangement', value: 'full_time', truthClass: 'clinician_provided' },
        ],
      }),
    ).find((s) => s.id === 'verify_ownership');

    expect(step).toBeDefined();
    expect(step!.controlledBy).toBe('institution');
    // VitalCV runs the check but does not conclude it.
    expect(step!.vitalcvRole).toBe('helps');
    expect(step!.why).toContain('does not prove the NPI belongs to you');
  });

  it('drops the ownership step once ownership is actually verified', () => {
    const verified = activated({
      permissions: { ...activated().permissions, privateCredentialHoldings: true },
    });
    expect(planNextSteps(verified).map((s) => s.id)).not.toContain('verify_ownership');
  });

  it('never claims VitalCV decides the employer outcome', () => {
    const step = planNextSteps(
      activated({
        fields: [
          ...activated().fields,
          { key: 'licensedStates', value: ['CO'], truthClass: 'clinician_provided' },
          { key: 'preferredStates', value: ['CO'], truthClass: 'clinician_provided' },
          { key: 'workArrangement', value: 'full_time', truthClass: 'clinician_provided' },
          { key: 'practiceState', value: 'CO', truthClass: 'public_source' },
        ],
        permissions: { ...activated().permissions, privateCredentialHoldings: true },
      }),
    ).find((s) => s.id === 'employer_review');

    expect(step).toBeDefined();
    expect(step!.controlledBy).toBe('employer');
    expect(step!.vitalcvNote).toContain('does not influence the decision');
  });

  it('introduces no readiness score of any kind', () => {
    const serialized = JSON.stringify(planNextSteps(activated())).toLowerCase();
    expect(serialized).not.toMatch(/\d+%/);
    expect(serialized).not.toContain('score');
    expect(serialized).not.toContain('readiness level');
    expect(serialized).not.toContain('tier');
  });
});

describe('carrying the NPI through sign-in', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  it('returns the clinician to the flow with the NPI intact', () => {
    expect(activationPath(NPI)).toBe(`/profile/activate?npi=${NPI}`);
    expect(signInHref(NPI)).toBe(
      `/sign-in?redirect_url=${encodeURIComponent(`/profile/activate?npi=${NPI}`)}`,
    );
  });

  it('remembers and recovers the NPI across a lost query string', () => {
    rememberPendingNpi(NPI);
    expect(readPendingNpi()).toBe(NPI);
    expect(resolveWorkingNpi(null)).toBe(NPI);
  });

  it('prefers the URL over what the browser remembered', () => {
    rememberPendingNpi(NPI);
    expect(resolveWorkingNpi('1114252613')).toBe('1114252613');
  });

  it('refuses to store or return anything that is not an NPI', () => {
    rememberPendingNpi('<script>alert(1)</script>');
    expect(readPendingNpi()).toBeNull();
    expect(resolveWorkingNpi('not-an-npi')).toBeNull();
    // A short number is not an NPI either.
    rememberPendingNpi('123');
    expect(readPendingNpi()).toBeNull();
  });

  it('never builds an off-site redirect', () => {
    expect(signInHref('https://evil.example.com')).toBe(
      `/sign-in?redirect_url=${encodeURIComponent('/profile/activate')}`,
    );
  });

  it('clears the handoff once it has done its job', () => {
    rememberPendingNpi(NPI);
    clearPendingNpi();
    expect(readPendingNpi()).toBeNull();
  });

  it('survives a browser that refuses storage entirely', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('storage blocked');
      },
    });
    // Safari private browsing throws on ACCESS. None of this may take the
    // activation surface down.
    expect(() => rememberPendingNpi(NPI)).not.toThrow();
    expect(readPendingNpi()).toBeNull();
    expect(() => clearPendingNpi()).not.toThrow();
  });
});
