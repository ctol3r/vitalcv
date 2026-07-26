import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The employer company profile mirrors the clinician profile: a Clerk-gated
// client surface. Mock Clerk as signed-in so the full profile shell renders in
// this bare SSR test (effects don't fire under renderToStaticMarkup, so the org
// read stays empty and every section shows its honest empty state).
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
}));

import EmployerProfilePage from '@/app/employer/profile/page';

/**
 * Employer company profile — the LinkedIn-style mirror of the clinician
 * profile, held to the same truth contract: organization IDENTITY (legal name +
 * Type-2 NPI) is NPPES-confirmed ("Source-confirmed"); everything else is
 * self-reported ("User-entered") and never presented as independently verified.
 */
describe('employer company profile', () => {
  const html = renderToStaticMarkup(<EmployerProfilePage />);

  it('renders the company-profile sections (mirror of the clinician profile)', () => {
    expect(html).toContain('About');
    expect(html).toContain('Specialties');
    expect(html).toContain('Locations');
    expect(html).toContain('Hiring');
    expect(html).toContain('Open roles');
  });

  it('keeps company data honest — self-reported, not independently verified', () => {
    expect(html).toContain('self-reported by your organization');
    expect(html).toContain('not independently');
    // self-reported fields carry the "User-entered" provenance badge
    expect(html).toContain('User-entered');
    // never a bare "Verified" status label (truth contract)
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('confirms identity against NPPES (source of the org identity)', () => {
    expect(html).toContain('NPPES');
    expect(html).toContain('Type');
  });
});
