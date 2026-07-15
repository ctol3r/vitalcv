import type { Metadata } from 'next';
import GetReadySurface from '@/app/get-ready/GetReadySurface';

// Canonical clinician activation route (Wave 0B). The strongest existing flow —
// session check → profession + NPI + attestation → POST /api/profile/npi/bootstrap
// → summary + email verification — now lives here. /get-ready and
// /clinician/onboarding redirect in. (Component file stays under app/get-ready/
// for now to keep the route-contract required-file set intact; it is
// route-agnostic. Richer result steps land in later 0B increments.)
export const metadata: Metadata = {
  title: 'Get ready · VitalCV',
  description:
    'Enter your NPI and VitalCV starts your clinician career wallet from your public NPPES record. License and exclusion checks run separately, with their own receipts.',
};

export default function OnboardingPage() {
  return <GetReadySurface />;
}
