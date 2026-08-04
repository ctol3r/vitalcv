jest.mock('../../../graphql/prisma_client', () => ({ __esModule: true, default: {} }));

import { normalizeUsaJobsItem, type UsaJobsDescriptor } from '../usajobs';

/**
 * The connector cannot run until USAJOBS_API_KEY is set, so the mapping would
 * otherwise ship completely unexercised. normalizeUsaJobsItem is pure, which
 * lets every rule it enforces be pinned here without a credential or a network
 * call.
 *
 * The descriptor below mirrors the documented USAJOBS Search API shape.
 */
function makeDescriptor(): UsaJobsDescriptor {
  return {
    PositionID: 'VA-2026-11482',
    PositionTitle: 'Physician (Internal Medicine)',
    PositionURI: 'https://www.usajobs.gov/job/11482',
    OrganizationName: 'Veterans Health Administration',
    DepartmentName: 'Department of Veterans Affairs',
    PositionLocation: [{ LocationName: 'Palo Alto, California', CountrySubDivisionCode: 'California' }],
    PositionRemuneration: [
      { MinimumRange: '250000', MaximumRange: '320000', RateIntervalCode: 'Per Year' },
    ],
    JobCategory: [{ Name: 'Medical Officer', Code: '0602' }],
    PublicationStartDate: '2026-07-28T00:00:00.0000',
    UserArea: { Details: { JobSummary: '<p>Inpatient internal medicine at the VA Palo Alto&nbsp;campus.</p>' } },
  };
}

describe('normalizeUsaJobsItem', () => {
  it('maps a complete posting', () => {
    const listing = normalizeUsaJobsItem(makeDescriptor());

    expect(listing).not.toBeNull();
    expect(listing!.sourceRef).toBe('VA-2026-11482');
    expect(listing!.sourceUrl).toBe('https://www.usajobs.gov/job/11482');
    expect(listing!.organizationName).toBe('Veterans Health Administration');
    expect(listing!.title).toBe('Physician (Internal Medicine)');
  });

  it('resolves a state NAME to the two-letter code the column stores', () => {
    const listing = normalizeUsaJobsItem(makeDescriptor());
    expect(listing!.state).toBe('CA');
  });

  it('takes the specialty from the employer’s own occupational series', () => {
    // Not inferred from the title — the series is how the employer classified
    // the vacancy, so it is stated rather than guessed.
    const listing = normalizeUsaJobsItem(makeDescriptor());
    expect(listing!.specialty).toBe('Medical Officer');
  });

  it('reads an annual salary range', () => {
    const listing = normalizeUsaJobsItem(makeDescriptor());
    expect(listing!.payMin).toBe(250000);
    expect(listing!.payMax).toBe(320000);
  });

  it('drops pay that is not annual rather than converting it', () => {
    // An hourly figure written into a column the board reads as annual would
    // publish a wrong number; assuming a 2080-hour year would invent one.
    const descriptor = makeDescriptor();
    descriptor.PositionRemuneration = [
      { MinimumRange: '95', MaximumRange: '130', RateIntervalCode: 'Per Hour' },
    ];

    const listing = normalizeUsaJobsItem(descriptor);
    expect(listing!.payMin).toBeNull();
    expect(listing!.payMax).toBeNull();
  });

  it('strips the HTML USAJOBS embeds in summaries', () => {
    const listing = normalizeUsaJobsItem(makeDescriptor());
    expect(listing!.description).toBe('Inpatient internal medicine at the VA Palo Alto campus.');
    expect(listing!.description).not.toContain('<p>');
  });

  it('never claims remote, because the vacancy record does not say', () => {
    const listing = normalizeUsaJobsItem(makeDescriptor());
    expect(listing!.remote).toBe(false);
  });

  it('returns null when the feed omits the identifier, link, title or employer', () => {
    for (const field of ['PositionID', 'PositionURI', 'PositionTitle'] as const) {
      const descriptor = makeDescriptor();
      delete descriptor[field];
      expect(normalizeUsaJobsItem(descriptor)).toBeNull();
    }

    const noEmployer = makeDescriptor();
    delete noEmployer.OrganizationName;
    delete noEmployer.DepartmentName;
    expect(normalizeUsaJobsItem(noEmployer)).toBeNull();
  });

  it('falls back to the department when no sub-organization is named', () => {
    const descriptor = makeDescriptor();
    delete descriptor.OrganizationName;
    expect(normalizeUsaJobsItem(descriptor)!.organizationName)
      .toBe('Department of Veterans Affairs');
  });

  it('leaves specialty null rather than guessing from the title', () => {
    const descriptor = makeDescriptor();
    delete descriptor.JobCategory;
    expect(normalizeUsaJobsItem(descriptor)!.specialty).toBeNull();
  });

  it('returns null for an absent descriptor', () => {
    expect(normalizeUsaJobsItem(undefined)).toBeNull();
  });
});
