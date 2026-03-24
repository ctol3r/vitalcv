import { redirect } from 'next/navigation';

// /onboarding/fetching is a legacy route — guard against direct navigation
// without NPI in session storage by returning to the NPI entry step.
export default function FetchingPage() {
  redirect('/onboarding');
}
