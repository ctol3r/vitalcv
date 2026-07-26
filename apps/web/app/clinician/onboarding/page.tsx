import { redirect } from 'next/navigation';

// /clinician/onboarding was a static list of future profile sections, not an
// interactive flow. Consolidated into the canonical /onboarding (Wave 0B).
export default function ClinicianOnboardingPage() {
  redirect('/onboarding');
}
