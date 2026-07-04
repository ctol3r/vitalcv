'use client';

/**
 * MatchaOnboardingSurface — client wrapper that supplies NPI/name from the holder provider
 * to the conversational onboarding, and returns to the hub on completion.
 */

import { useRouter } from 'next/navigation';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { MatchaOnboarding } from './MatchaOnboarding';

export function MatchaOnboardingSurface() {
  const router = useRouter();
  const { data } = useClinicianMobile();
  const person = data.workspace?.personProfile;

  return (
    <div style={{ padding: '28px 20px 96px' }}>
      <MatchaOnboarding
        npi={person?.npi ?? undefined}
        clinicianName={person?.firstName ?? undefined}
        onComplete={() => router.push('/holder/matcha')}
      />
    </div>
  );
}
