import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The profile now renders a Clerk-backed <ProfileHeader/> (avatar + name). Mock
// Clerk so the page renders signed-out in this bare render test; the header
// degrades to a placeholder and the truth-contract SECTIONS below still render.
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
  useClerk: () => ({ openUserProfile: () => {} }),
}));

import ClinicianProfilePage from '@/app/clinician/profile/page';

/**
 * Profile state-licensure section — honesty contract.
 *
 * VitalCV lists state license numbers on the clinician profile, but a number is
 * self-attested (USER_ENTERED) until a state-board SOURCE confirms it. Those
 * lanes are agreement-blocked today, so the license STATUS stays UNKNOWN
 * ("pending state-board source access") — never Source-confirmed/Verified.
 */

describe('clinician profile — state licensure', () => {
  const html = renderToStaticMarkup(<ClinicianProfilePage />);

  it('renders a State licensure section with a license number field', () => {
    expect(html).toContain('State licensure');
    expect(html).toContain('License number');
    expect(html).toContain('State-issued license #');
    expect(html).toContain('License state');
    expect(html).toContain('Expiration');
  });

  it('keeps licensure honest — status is pending source access, not verified', () => {
    expect(html).toContain('Pending state-board source access');
    // page-wide honesty disclaimer still present
    expect(html).toContain('not verified until source-backed');
    // never a bare "Verified" status label (truth contract)
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('the license-number field carries the self-attested (User-entered) provenance', () => {
    // USER_ENTERED renders as the "User-entered" badge; the licensure section
    // must not present the number as "Source-confirmed" (the VERIFIED label).
    expect(html).toContain('User-entered');
    const licenseIdx = html.indexOf('State-issued license #');
    expect(licenseIdx).toBeGreaterThan(-1);
    // within a small window after the license-number input, no source-confirmed claim
    const windowText = html.slice(Math.max(0, licenseIdx - 400), licenseIdx + 400);
    expect(windowText).not.toContain('Source-confirmed');
  });
});
