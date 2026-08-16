/**
 * Greenhouse connector + the clinical relevance gate.
 *
 * The gate is the load-bearing part. `types.ts` promised the runner owned a
 * relevance gate; `rejectedNotClinical` was declared and summed but never
 * incremented, because USAJOBS filters clinically server-side. A public ATS
 * board has no such filter, so without the gate VitalCV's clinical board fills
 * with engineers and recruiters.
 */

import { BOARDS, GreenhouseBoardsConnector, extractState, extractStatedProfession, extractStatedSpecialty, isRemote, normalizeBoardJobs, roundRobin, toPlainText } from '../greenhouse';
import { isClinicalRole } from '../clinicalRelevance';
import type { FeedListing } from '../types';

describe('isClinicalRole', () => {
  it('accepts roles a licensed clinician holds', () => {
    for (const title of [
      'Registered Nurse',
      'Evenings Digital Triage Registered Nurse',
      'Nurse Practitioner - Primary Care',
      'GI- Nurse Practitioner',
      'Advanced Practice Provider - California',
      'Collaborating Physician (MD) - Pennsylvania',
      'Certified Medical Assistant',
      'Clinical Admissions Therapist',
      'Associate Mental Health Therapist',
      'Licensed Clinical Social Worker',
      'Staff Pharmacist',
      'Physician Assistant',
    ]) {
      expect([title, isClinicalRole(title)]).toEqual([title, true]);
    }
  });

  it('rejects non-clinical roles at a health company', () => {
    for (const title of [
      'Senior Software Engineer',
      'Chief Revenue Officer',
      'Account Executive, Enterprise',
      'Product Manager, Growth',
      'Staff Data Scientist',
      'Director of Marketing',
      'Controller',
      'Customer Success Manager',
    ]) {
      expect([title, isClinicalRole(title)]).toEqual([title, false]);
    }
  });

  it('rejects the near-misses that carry a clinical word but are not clinical jobs', () => {
    // These are the whole reason the override list exists — each one matches a
    // clinical pattern and none is a job a licensed clinician is hired into.
    for (const title of [
      'Clinical Recruiter',
      'Director of Clinical Operations',
      'Clinical Data Engineer',
      'Medical Billing Specialist',
      'Provider Network Sales Manager',
      'Talent Partner, Clinical',
      'Medical Records Coordinator',
      'Patient Scheduler',
    ]) {
      expect([title, isClinicalRole(title)]).toEqual([title, false]);
    }
  });

  it('does not mistake a Maryland location suffix for a physician credential', () => {
    expect(isClinicalRole('Territory Manager (MD, Baltimore County)')).toBe(false);
  });

  it('keeps clinical leadership while dropping operations leadership', () => {
    // The ambiguous edge, pinned in both directions so a later "simplification"
    // to a blanket /director/ override goes red.
    expect(isClinicalRole('Medical Director')).toBe(true);
    expect(isClinicalRole('Director of Nursing')).toBe(true);
    expect(isClinicalRole('Director of Clinical Operations')).toBe(false);
    expect(isClinicalRole('Clinical Program Manager')).toBe(false);
  });

  it('does not fire on substrings inside unrelated words', () => {
    // Word-boundary matching: "PA" in "Palo Alto", "RN" in "Learning",
    // "DO" in "Documentation".
    for (const title of [
      'Office Manager, Palo Alto',
      'Learning and Development Lead',
      'Documentation Systems Analyst',
      'Partnerships Lead',
    ]) {
      expect([title, isClinicalRole(title)]).toEqual([title, false]);
    }
  });

  it('treats an empty or whitespace title as not clinical', () => {
    expect(isClinicalRole('')).toBe(false);
    expect(isClinicalRole('   ')).toBe(false);
  });
});

describe('extractState', () => {
  it('reads a two-letter code or a state name from free text', () => {
    expect(extractState('New York, NY')).toBe('NY');
    expect(extractState('San Francisco, California')).toBe('CA');
    expect(extractState('Texas')).toBe('TX');
    expect(extractState('Boston, MA, USA')).toBe('MA');
  });

  it('returns null rather than guessing a state that was never stated', () => {
    for (const value of ['Remote, USA', 'Multiple Locations', 'United States', '', null, undefined]) {
      expect([String(value), extractState(value as string | null | undefined)]).toEqual([String(value), null]);
    }
  });

  it('never mistakes a non-state two-letter word for a code', () => {
    // "GO" and "ON" are not US states; "ON" is an Ontario code.
    expect(extractState('Toronto, ON')).toBeNull();
  });
});

describe('isRemote', () => {
  it('reports remote only when the feed says so', () => {
    expect(isRemote('Remote, USA')).toBe(true);
    expect(isRemote('Telehealth')).toBe(true);
    expect(isRemote('New York, NY')).toBe(false);
    expect(isRemote(null)).toBe(false);
  });
});

describe('toPlainText', () => {
  it('unescapes and strips Greenhouse HTML content', () => {
    expect(toPlainText('&lt;p&gt;Hello&nbsp;world&lt;/p&gt;')).toBe('Hello world');
  });

  it('returns null for empty content rather than an empty string', () => {
    expect(toPlainText(undefined)).toBeNull();
    expect(toPlainText('&lt;p&gt;&lt;/p&gt;')).toBeNull();
  });
});

describe('normalizeBoardJobs', () => {
  const job = {
    id: 4321,
    title: 'Registered Nurse',
    absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/4321',
    updated_at: '2026-07-30T18:44:53-04:00',
    location: { name: 'Austin, TX' },
    content: '&lt;p&gt;Care for patients.&lt;/p&gt;',
  };

  it('namespaces sourceRef by board so two boards cannot collide on an id', () => {
    const [a] = normalizeBoardJobs([job], 'acme');
    const [b] = normalizeBoardJobs([job], 'other');
    expect(a.sourceRef).toBe('acme:4321');
    expect(b.sourceRef).toBe('other:4321');
    expect(a.sourceRef).not.toBe(b.sourceRef);
  });

  it('applies to the employer’s own posting, never to VitalCV', () => {
    const [listing] = normalizeBoardJobs([job], 'acme');
    expect(listing.sourceUrl).toBe('https://job-boards.greenhouse.io/acme/jobs/4321');
  });

  it('never invents a specialty or a pay figure', () => {
    const [listing] = normalizeBoardJobs([job], 'acme');
    // Greenhouse publishes neither. A guessed specialty puts a role in front
    // of the wrong clinician; a parsed salary presents a guess as a figure.
    expect(listing.specialty).toBeNull();
    expect(listing.payMin).toBeNull();
    expect(listing.payMax).toBeNull();
  });

  it('drops a job missing an id, title, or url instead of inventing one', () => {
    expect(normalizeBoardJobs([{ ...job, id: undefined }], 'acme')).toHaveLength(0);
    expect(normalizeBoardJobs([{ ...job, title: '  ' }], 'acme')).toHaveLength(0);
    expect(normalizeBoardJobs([{ ...job, absolute_url: undefined }], 'acme')).toHaveLength(0);
  });

  it('leaves postedAt null when the feed date is unparseable', () => {
    const [listing] = normalizeBoardJobs([{ ...job, updated_at: 'not-a-date' }], 'acme');
    expect(listing.postedAt).toBeNull();
  });
});

const okJobShared = {
  id: 1,
  title: 'Registered Nurse',
  absolute_url: 'https://job-boards.greenhouse.io/a/jobs/1',
  location: { name: 'Austin, TX' },
};

describe('GreenhouseBoardsConnector — completeness gates expiry', () => {
  const okJob = {
    id: 1,
    title: 'Registered Nurse',
    absolute_url: 'https://job-boards.greenhouse.io/a/jobs/1',
    location: { name: 'Austin, TX' },
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports complete when every board answers', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [okJob] }),
    } as unknown as Response);

    const result = await new GreenhouseBoardsConnector(['a', 'b']).fetch({ limit: 100 });
    expect(result.complete).toBe(true);
    expect(result.listings).toHaveLength(2);
  });

  it('reports INCOMPLETE when one board fails — expiry must not close its rows', async () => {
    // The costly mistake this prevents: claiming completeness after an outage
    // lets expiry close that employer's entire live inventory.
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [okJob] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response);

    const result = await new GreenhouseBoardsConnector(['a', 'b']).fetch({ limit: 100 });
    expect(result.complete).toBe(false);
    expect(result.listings).toHaveLength(1);
  });

  it('reports INCOMPLETE when a board throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const result = await new GreenhouseBoardsConnector(['a']).fetch({ limit: 100 });
    expect(result.complete).toBe(false);
  });

  it('reports INCOMPLETE when the limit drops rows', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [okJob, { ...okJob, id: 2 }] }),
    } as unknown as Response);

    const result = await new GreenhouseBoardsConnector(['a', 'b', 'c']).fetch({ limit: 2 });
    expect(result.complete).toBe(false);
    expect(result.listings).toHaveLength(2);
  });

  it('READS EVERY BOARD even when the first one alone exceeds the limit', async () => {
    /*
     * The production defect this pins. The first version broke out of the loop
     * once the running total hit the limit, so a big first board consumed the
     * whole budget and every later employer went unfetched — 188 live rows,
     * all from one employer, with eleven never read.
     */
    const big = Array.from({ length: 300 }, (_, i) => ({ ...okJob, id: i + 1 }));
    const fetchSpy = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: big }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [{ ...okJob, id: 901 }] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [{ ...okJob, id: 902 }] }) } as unknown as Response);

    const result = await new GreenhouseBoardsConnector(['big', 'small1', 'small2']).fetch({ limit: 200 });

    // Every board was requested — no employer is skipped by ordering.
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // And each is represented in the kept set.
    const boards = new Set(result.listings.map((l) => l.organizationName));
    expect(boards).toEqual(new Set(['big', 'small1', 'small2']));
  });

  it('gives a small board its rows even against a much larger one', async () => {
    const big = Array.from({ length: 100 }, (_, i) => ({ ...okJob, id: i + 1 }));
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: big }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [{ ...okJob, id: 901 }] }) } as unknown as Response);

    const result = await new GreenhouseBoardsConnector(['big', 'small']).fetch({ limit: 10 });
    expect(result.listings.some((l) => l.organizationName === 'small')).toBe(true);
    expect(result.listings).toHaveLength(10);
  });

  it('is configured without any credential — the endpoint is public', () => {
    expect(new GreenhouseBoardsConnector().isConfigured()).toBe(true);
    expect(new GreenhouseBoardsConnector([]).isConfigured()).toBe(false);
  });
});

describe('completeness is reachable, so expiry can run', () => {
  afterEach(() => jest.restoreAllMocks());

  it('declares a ceiling above the roster’s whole size', () => {
    // At the runner's default of 200 this feed truncated every run, so
    // `complete` was permanently false and expiry never ran — a filled role
    // would have stayed ACTIVE on VitalCV forever.
    const connector = new GreenhouseBoardsConnector();
    expect(connector.maxListings).toBeGreaterThan(835);
  });

  it('reports complete on a healthy run that keeps everything', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [okJobShared] }),
    } as unknown as Response);

    const connector = new GreenhouseBoardsConnector(['a', 'b']);
    const result = await connector.fetch({ limit: connector.maxListings });
    expect(result.complete).toBe(true);
  });
});

describe('the board roster', () => {
  it('is explicit and de-duplicated — a roster, never a crawl', () => {
    expect(BOARDS.length).toBeGreaterThan(0);
    expect(new Set(BOARDS).size).toBe(BOARDS.length);
  });
});


describe('roundRobin', () => {
  const row = (board: string, n: number): FeedListing => ({
    sourceRef: `${board}:${n}`,
    sourceUrl: `https://example.test/${board}/${n}`,
    title: 'Registered Nurse',
    organizationName: board,
    state: 'CA',
    remote: false,
    description: null,
    specialty: null,
    profession: null,
    payMin: null,
    payMax: null,
    postedAt: null,
  });

  it('interleaves so no board is starved by another', () => {
    const map = new Map([
      ['a', [row('a', 1), row('a', 2), row('a', 3)]],
      ['b', [row('b', 1)]],
    ]);
    const taken = roundRobin(map, 3);
    expect(taken.map((t) => t.organizationName)).toEqual(['a', 'b', 'a']);
  });

  it('drains the remaining boards once a queue empties', () => {
    const map = new Map([
      ['a', [row('a', 1), row('a', 2), row('a', 3)]],
      ['b', [row('b', 1)]],
    ]);
    expect(roundRobin(map, 10)).toHaveLength(4);
  });

  it('terminates on empty input rather than spinning', () => {
    expect(roundRobin(new Map(), 10)).toEqual([]);
    expect(roundRobin(new Map([['a', []]]), 10)).toEqual([]);
  });
});

describe('extractStatedSpecialty', () => {
  const job = (metadata: unknown) => ({ metadata } as never);

  it('reads the specialty the employer stated, verbatim', () => {
    // The age qualifier is part of what the employer said. Trimming it to a
    // tidy "Family Medicine" would be VitalCV restating their statement.
    expect(extractStatedSpecialty(job([
      { name: 'Clinical Specialty', value: 'Family Medicine (14 years and older)' },
    ]))).toBe('Family Medicine (14 years and older)');
  });

  it('matches the field name case- and whitespace-insensitively', () => {
    expect(extractStatedSpecialty(job([
      { name: '  clinical specialty ', value: 'Urgent Care' },
    ]))).toBe('Urgent Care');
  });

  it('reads no other metadata field', () => {
    // Every one of these sits beside the specialty field on real boards. None
    // is a specialty, and treating one as such misfiles the role.
    expect(extractStatedSpecialty(job([
      { name: 'Clinician Type', value: 'MD or DO' },
      { name: 'Provider Role', value: 'Casual Provider' },
      { name: 'Operations Role', value: 'MSS' },
      { name: 'Market', value: 'Phoenix' },
      { name: 'Employment Type', value: 'Regular' },
    ]))).toBeNull();
  });

  it('is null when the employer left the field empty', () => {
    // Greenhouse returns unfilled custom fields as null, not as absent keys.
    expect(extractStatedSpecialty(job([
      { name: 'Clinical Specialty', value: null },
    ]))).toBeNull();
    expect(extractStatedSpecialty(job([
      { name: 'Clinical Specialty', value: '   ' },
    ]))).toBeNull();
  });

  it('refuses a non-string value rather than stringifying it', () => {
    // A multi-select comes back as an array. Rendering ['A','B'] into a
    // specialty string would state something the employer did not.
    expect(extractStatedSpecialty(job([
      { name: 'Clinical Specialty', value: ['Family Medicine', 'Urgent Care'] },
    ]))).toBeNull();
    expect(extractStatedSpecialty(job([
      { name: 'Clinical Specialty', value: { min_value: '0.0' } },
    ]))).toBeNull();
  });

  it('survives boards that publish no metadata at all', () => {
    expect(extractStatedSpecialty(job(undefined))).toBeNull();
    expect(extractStatedSpecialty(job(null))).toBeNull();
    expect(extractStatedSpecialty(job([]))).toBeNull();
    expect(extractStatedSpecialty(job([{ value: 'orphan' }]))).toBeNull();
  });
});

describe('normalizeBoardJobs specialty', () => {
  const base = {
    id: 1,
    title: 'Nurse Practitioner',
    absolute_url: 'https://job-boards.greenhouse.io/x/jobs/1',
    location: { name: 'Phoenix, AZ' },
  };

  it('carries the stated specialty onto the listing', () => {
    const [listing] = normalizeBoardJobs([{
      ...base,
      metadata: [{ name: 'Clinical Specialty', value: 'Virtual Care' }],
    }] as never, 'onemedical');
    expect(listing.specialty).toBe('Virtual Care');
  });

  it('leaves specialty null when the board states none, never guessing the title', () => {
    // The title says "Nurse Practitioner - Cardiology". That is a title, not
    // the employer's specialty field, and must not become one.
    const [listing] = normalizeBoardJobs([{
      ...base,
      title: 'Nurse Practitioner - Cardiology',
    }] as never, 'twochairs');
    expect(listing.specialty).toBeNull();
  });

  it('still publishes no pay figure', () => {
    const [listing] = normalizeBoardJobs([{
      ...base,
      metadata: [{ name: 'Clinical Specialty', value: 'Urgent Care' }],
    }] as never, 'onemedical');
    expect([listing.payMin, listing.payMax]).toEqual([null, null]);
  });
});

describe('extractStatedProfession', () => {
  const job = (value: unknown) => ({
    id: 1,
    title: 'Family Medicine Physician',
    absolute_url: 'https://example.com/1',
    metadata: [{ name: 'Clinician Type', value }],
  }) as never;

  it('maps each licence the roster actually publishes', () => {
    expect(extractStatedProfession(job(['MD or DO']))).toBe('physician');
    expect(extractStatedProfession(job(['NP or PA']))).toBe('advanced_practice');
    expect(extractStatedProfession(job(['RN']))).toBe('nursing');
  });

  it('returns null when the employer names more than one licence', () => {
    // 19 live jobs do this. Filing a role open to either under one of them
    // drops it out of the other's filter, so it falls back to the title.
    expect(extractStatedProfession(job(['MD or DO', 'NP or PA']))).toBeNull();
  });

  it('returns null on silence and on values we have not mapped', () => {
    expect(extractStatedProfession(job([]))).toBeNull();
    expect(extractStatedProfession(job(null))).toBeNull();
    expect(extractStatedProfession(job(['Chiropractor']))).toBeNull();
    expect(extractStatedProfession({ id: 1, title: 'x', absolute_url: 'u' } as never)).toBeNull();
  });

  it('reads only the clinician-type field, never a neighbouring one', () => {
    const decoy = {
      id: 1,
      title: 'Family Medicine Physician',
      absolute_url: 'https://example.com/1',
      metadata: [{ name: 'Provider Role', value: ['MD or DO'] }],
    } as never;
    expect(extractStatedProfession(decoy)).toBeNull();
  });
});
