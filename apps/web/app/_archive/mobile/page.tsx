import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import React from 'react';
import MobileExperience from '@/components/mobile/MobileExperience';
import { getBackendBase } from '@/lib/api';
import type { OpportunityListPayload } from '@/lib/launch/marketplace';
import {
  buildMobileOpportunityCards,
  normalizeClinicianApplications,
  normalizeMatchPayload,
  normalizeMobileTrustState,
  type MobileDashboardData,
} from '@/lib/mobile/dashboard';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

type MobileTab = 'overview' | 'roles' | 'applications';

interface MobilePageProps {
  searchParams?: Promise<{
    tab?: string;
  }>;
}

export const metadata: Metadata = {
  title: 'VitalCV Mobile',
  description: 'Live mobile workspace for clinician identity, readiness, opportunities, and application status.',
};

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const localBackendConfigured = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').includes('localhost');
const clerkEnabled = Boolean(clerkPublishableKey)
  && !(localBackendConfigured && clerkPublishableKey.startsWith('pk_live_'));
const MOBILE_SERVER_TIMEOUT_MS = 4_000;

async function fetchBackendJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendBase()}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(MOBILE_SERVER_TIMEOUT_MS),
      ...init,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as T;
  } catch {
    return null;
  }
}

async function fetchMobileOpportunities(): Promise<OpportunityListPayload> {
  return await fetchBackendJson<OpportunityListPayload>('/api/opportunities?limit=24')
    ?? { opportunities: [], total: 0 };
}

async function getMobileSession(): Promise<Awaited<ReturnType<typeof auth>> | null> {
  if (!clerkEnabled) {
    return null;
  }

  try {
    return await auth();
  } catch {
    return null;
  }
}

function normalizeWorkspace(
  raw: unknown,
): MobileDashboardData['workspace'] {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as {
    personProfile?: {
      npi?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      specialty?: string | null;
      stateOfPractice?: string | null;
      completeness?: number | null;
    } | null;
  };

  return {
    personProfile: data.personProfile
      ? {
          npi: data.personProfile.npi ?? null,
          firstName: data.personProfile.firstName ?? null,
          lastName: data.personProfile.lastName ?? null,
          specialty: data.personProfile.specialty ?? null,
          stateOfPractice: data.personProfile.stateOfPractice ?? null,
          completeness:
            typeof data.personProfile.completeness === 'number'
              ? data.personProfile.completeness
              : null,
        }
      : null,
  };
}

function parseInitialTab(value: string | undefined): MobileTab {
  return value === 'roles' || value === 'applications' ? value : 'overview';
}

export default async function MobilePage({ searchParams }: MobilePageProps) {
  const session = await getMobileSession();
  const signedIn = Boolean(session?.userId);

  const [workspaceRaw, applicationsRaw, opportunityPayload] = await Promise.all([
    signedIn
      ? fetchBackendJson<unknown>('/api/me/workspaces', {
          headers: buildMarketplaceHeaders(session!),
        })
      : Promise.resolve(null),
    signedIn
      ? fetchBackendJson<unknown>('/api/clinician/applications', {
          headers: buildMarketplaceHeaders(session!),
        })
      : Promise.resolve(null),
    fetchMobileOpportunities(),
  ]);

  const workspace = normalizeWorkspace(workspaceRaw);
  const applications = normalizeClinicianApplications(applicationsRaw);
  const npi = workspace?.personProfile?.npi ?? null;

  const [trustRaw, matchRaw] = npi
    ? await Promise.all([
        fetchBackendJson<unknown>(`/api/trust-state/${encodeURIComponent(npi)}`),
        fetchBackendJson<unknown>(`/api/matcha/opportunities/${encodeURIComponent(npi)}`),
      ])
    : [null, null];

  const trustState = normalizeMobileTrustState(trustRaw);
  const matchPayload = normalizeMatchPayload(matchRaw);

  const initialData: MobileDashboardData = {
    signedIn,
    workspace,
    trustState,
    applications,
    opportunities: buildMobileOpportunityCards({
      opportunities: opportunityPayload.opportunities,
      applications,
      matchPayload,
      specialty: workspace?.personProfile?.specialty ?? null,
      state: workspace?.personProfile?.stateOfPractice ?? null,
    }),
    missingForHigherMatches: matchPayload?.missingForHigherMatches ?? [],
    refreshedAt: new Date().toISOString(),
  };

  const resolvedSearchParams = await searchParams;

  return (
    <MobileExperience
      initialData={initialData}
      initialTab={parseInitialTab(resolvedSearchParams?.tab)}
    />
  );
}
