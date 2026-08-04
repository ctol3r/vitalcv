/**
 * The illustrative example — reachable ONLY through the explicit
 * "Load an illustrative example" control, never from a real NPI.
 *
 * Uses the exact same shapes as the live path (`ClinicianCareerProfile`,
 * `LoopMatch`), so the fixture exercises the same components and cannot
 * drift into a second implementation. Fictional clinician and fictional
 * organizations per the Z0 data rule (masked-tail NPI, never a well-formed
 * ten-digit number); every consuming surface renders an illustrative label
 * when `isDemo` is true.
 */

import type { ClinicianCareerProfile } from '@/lib/career-loop/profile';
import type { LoopMatch } from '@/lib/career-loop/useCareerLoop';

export const DEMO_FIXTURE: {
  profile: ClinicianCareerProfile;
  matches: LoopMatch[];
} = {
  profile: {
    npi: '····· 4821',
    displayName: 'K. Osei',
    monogram: 'KO',
    credential: 'PA-C',
    specialty: 'Physician Assistant — Emergency Medicine',
    location: 'CO',
    identitySource: 'ILLUSTRATIVE',
    readinessSummary: { answered: 2, total: 5, needsReview: 3 },
  },
  matches: [
    {
      opportunityId: 'demo-cascade',
      title: 'Emergency Medicine PA',
      organizationName: 'Cascade Regional Medical Center',
      location: 'CO',
      hiringType: 'Full-time',
      matchBand: 'NEAR_CLEAR',
      fitReasons: [
        { label: 'Specialty matches: emergency medicine', dimension: 'specialty' },
        { label: 'State eligibility: CO practice location', dimension: 'state' },
      ],
      blockers: [{ label: 'State licensure not source-checked' }],
    },
    {
      opportunityId: 'demo-harbor',
      title: 'Urgent Care PA',
      organizationName: 'Blue Harbor Health',
      location: 'CO',
      hiringType: 'Full-time',
      matchBand: 'PARTIAL',
      fitReasons: [{ label: 'Adjacent specialty: urgent care', dimension: 'specialty' }],
      blockers: [],
    },
  ],
};
