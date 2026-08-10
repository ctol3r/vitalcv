/**
 * NPPES → ClinicianProfile: the honesty contract.
 *
 * Guard for a production fabrication found 2026-08-10. The profile builder
 * constructed its credential set UNCONDITIONALLY, outside the NPPES try/catch,
 * over a `let state = 'CA'` default — so every NPI came back holding an active
 * NPI at L3, an active state licence at L2 from "<state> Medical Board", and
 * `sanctions_clear` at L2: an exclusion screen that never ran.
 *
 * Observed live on `GET /api/matcha/opportunities/:npi`, every one returning the
 * public fit reason "CA license on file, not source-checked":
 *
 *   1234567893  an invented number             (NPPES result_count = 0)
 *   1346053246  a real PA-C, NO licence in NPPES
 *   1225082860  Department of Veterans Affairs (NPI-2, Military Hospital)
 *   1942355292  Palo Alto Medical Foundation   (NPI-2, clinic pharmacy)
 *
 * We told a pharmacy it held a California medical licence.
 *
 * Each fixture below is the real NPPES shape for one of those NPIs.
 */
import {
  buildBaseClinicianProfile,
  licenseAuthorityFor,
  type FetchLike,
} from '../clinicianProfileFromNppes';

/** A fetch that returns one canned NPPES payload. */
const serving = (payload: unknown, ok = true): FetchLike =>
  async () => ({ ok, json: async () => payload });

/** A fetch that fails, as NPPES does under timeout or outage. */
const failing: FetchLike = async () => {
  throw new Error('NPPES unreachable');
};

const individual = (opts: { license?: string; taxonomy?: string; state?: string } = {}) => ({
  result_count: 1,
  results: [
    {
      enumeration_type: 'NPI-1',
      basic: { first_name: 'Test', last_name: 'Provider', status: 'A' },
      taxonomies: [
        {
          code: opts.taxonomy ?? '207R00000X',
          primary: true,
          state: opts.state ?? 'CA',
          ...(opts.license ? { license: opts.license } : {}),
        },
      ],
      addresses: [{ address_purpose: 'LOCATION', state: opts.state ?? 'CA' }],
    },
  ],
});

/** NPI-2 — the Department of Veterans Affairs shape. */
const organisation = () => ({
  result_count: 1,
  results: [
    {
      enumeration_type: 'NPI-2',
      basic: { organization_name: 'DEPARTMENT OF VETERANS AFFAIRS', status: 'A' },
      taxonomies: [{ code: '286500000X', primary: true, state: 'CA' }],
      addresses: [{ address_purpose: 'LOCATION', state: 'CA' }],
    },
  ],
});

const credential = (profile: any, key: string) =>
  profile.credentials.find((c: any) => c.key === key);

describe('an unresolved NPI yields NO profile', () => {
  it('returns null for a number NPPES does not know', async () => {
    const profile = await buildBaseClinicianProfile('1234567893', serving({ result_count: 0, results: [] }));
    expect(profile).toBeNull();
  });

  it('returns null when NPPES is unreachable, rather than defaulting', async () => {
    expect(await buildBaseClinicianProfile('1346053246', failing)).toBeNull();
  });

  it('returns null for a non-200 from NPPES', async () => {
    expect(await buildBaseClinicianProfile('1346053246', serving({}, false))).toBeNull();
  });

  it('REFUSES an organisation — a hospital is not a clinician', async () => {
    // NPI 1225082860, Department of Veterans Affairs. Previously this produced a
    // profile asserting a California medical licence.
    expect(await buildBaseClinicianProfile('1225082860', serving(organisation()))).toBeNull();
  });
});

describe('sanctions are never asserted from NPPES', () => {
  it('leaves sanctions_clear pending even for a fully resolved provider', async () => {
    const profile = await buildBaseClinicianProfile('1952388852', serving(individual({ license: 'A72463' })));

    // NPPES says nothing about exclusion. Asserting "not excluded" without
    // asking is the most damaging claim in this file.
    expect(credential(profile, 'sanctions_clear')).toMatchObject({
      status: 'pending',
      claimLevel: 'L1',
    });
    expect(credential(profile, 'sanctions_clear').issuer).not.toBe('NPI Registry');
  });
});

describe('a licence claim needs a self-reported number', () => {
  it('asserts state_license at L2 when NPPES carries a licence number', async () => {
    // The real shape of the hospitalist volunteer: licence A72463, CA.
    const profile = await buildBaseClinicianProfile(
      '1952388852',
      serving(individual({ license: 'A72463', taxonomy: '208M00000X' })),
    );

    expect(credential(profile, 'state_license')).toMatchObject({
      status: 'active',
      claimLevel: 'L2',
      state: 'CA',
      issuer: 'State medical board',
    });
  });

  it('leaves state_license pending for a provider with NO licence in NPPES', async () => {
    // The real shape of the PA-C volunteer: a valid provider, no licence number.
    const profile = await buildBaseClinicianProfile(
      '1346053246',
      serving(individual({ taxonomy: '363A00000X' })),
    );

    expect(credential(profile, 'state_license')).toMatchObject({
      status: 'pending',
      claimLevel: 'L1',
    });
  });

  it('never attributes a PA licence to a medical board', async () => {
    const profile = await buildBaseClinicianProfile(
      '1346053246',
      serving(individual({ license: 'PA-9999', taxonomy: '363A00000X' })),
    );

    expect(credential(profile, 'state_license').issuer).toBe('State physician assistant board');
  });
});

describe('licenseAuthorityFor names the body that actually issues', () => {
  it.each([
    ['363A00000X', 'State physician assistant board'],
    ['363L00000X', 'State board of nursing'],
    ['163W00000X', 'State board of nursing'],
    ['207R00000X', 'State medical board'],
    ['208M00000X', 'State medical board'],
    ['1835P1200X', 'State board of pharmacy'],
    ['999X99999X', 'State licensing authority'],
  ])('%s → %s', (code, expected) => {
    expect(licenseAuthorityFor(code)).toBe(expected);
  });
});

describe('no default jurisdiction', () => {
  it('leaves states empty when NPPES gives no state', async () => {
    const profile = await buildBaseClinicianProfile('1952388852', serving({
      result_count: 1,
      results: [
        {
          enumeration_type: 'NPI-1',
          basic: { first_name: 'No', last_name: 'State' },
          taxonomies: [{ code: '207R00000X', primary: true }],
          addresses: [],
        },
      ],
    }));

    expect(profile!.states).toEqual([]);
    // The old code placed every such provider in California.
    expect(JSON.stringify(profile)).not.toContain('"CA"');
  });
});
