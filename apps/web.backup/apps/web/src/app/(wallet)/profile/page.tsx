/**
 * Clinician Profile Page
 * Main profile page displaying identity header, career summary, and experience timeline
 */

'use client';

import { useClinicianProfile } from '@/hooks/use-clinician-profile';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { CareerSummary } from '@/components/profile/CareerSummary';
import { ExperienceTimeline } from '@/components/profile/ExperienceTimeline';
import { ReferencesSection } from '@/components/references/ReferencesSection';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const { profile, state, error, refresh } = useClinicianProfile();

  if (state === 'loading') {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading profile</AlertTitle>
          <AlertDescription>
            {error || 'Failed to load your profile. Please try again.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No profile found</AlertTitle>
          <AlertDescription>
            Your profile could not be loaded. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <ProfileHeader profile={profile} />
      <CareerSummary profile={profile} />
      <ExperienceTimeline profile={profile} />
      <ReferencesSection clinicianId={profile.clinicianId} />
    </div>
  );
}
