/**
 * /profile/[npi] — the clinician-published public career profile page.
 * Contract: renders ONLY when the backend says shared; 404s otherwise;
 * self-attested content is labeled self-attested; links to /verify/[npi].
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PublicCareerProfilePage from '@/app/profile/[npi]/page';

const NPI = '1234567890';

const SHARED_PAYLOAD = {
  shared: true,
  profile: {
    npi: NPI,
    firstName: 'Macie',
    lastName: 'Miller',
    specialty: 'Physician Assistant',
    stateOfPractice: 'CA',
    linkedinUrl: 'https://www.linkedin.com/in/macie',
    portfolioUrl: null,
    selfAttested: {
      medicalSchool: { institutionName: 'UC Davis', degree: 'MPAS', graduationYear: 2019 },
      workHistory: [{ employer: 'Cedar Health', role: 'PA-C', startYear: 2020 }],
      careerGoals: 'Cardiology team lead.',
    },
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
};

function mockFetch(sharedStatus: number, sharedBody: unknown) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/profile/public/')) {
      return new Response(JSON.stringify(sharedBody), { status: sharedStatus });
    }
    // passport identity fetch — always degrade gracefully in tests
    return new Response('{}', { status: 503 });
  }) as unknown as typeof fetch;
}

describe('/profile/[npi]', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('renders the shared career profile with self-attested labeling', async () => {
    global.fetch = mockFetch(200, SHARED_PAYLOAD);
    const el = await PublicCareerProfilePage({ params: Promise.resolve({ npi: NPI }) });
    const html = renderToStaticMarkup(el);

    expect(html).toContain('Macie Miller');
    expect(html).toContain('Cedar Health');
    expect(html).toContain('Self-attested by the clinician');
    expect(html).toContain(`/verify/${NPI}`);
    expect(html).toContain('shared by the clinician');
    // truth contract: no bare Verified label
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('404s when the profile is not shared', async () => {
    global.fetch = mockFetch(404, { error: { code: 'NOT_FOUND' } });
    await expect(
      PublicCareerProfilePage({ params: Promise.resolve({ npi: NPI }) }),
    ).rejects.toThrowError();
  });

  it('404s on a malformed NPI without calling the backend', async () => {
    const spy = vi.fn();
    global.fetch = spy as unknown as typeof fetch;
    await expect(
      PublicCareerProfilePage({ params: Promise.resolve({ npi: 'not-an-npi' }) }),
    ).rejects.toThrowError();
    expect(spy).not.toHaveBeenCalled();
  });
});
