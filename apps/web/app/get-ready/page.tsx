import { redirect } from 'next/navigation';

// /get-ready consolidated into the canonical /onboarding (Wave 0B). The flow
// component (GetReadySurface.tsx) stays in this folder and is rendered by
// /onboarding; this route now just forwards, so existing links keep working.
export default function GetReadyPage() {
  redirect('/onboarding');
}
