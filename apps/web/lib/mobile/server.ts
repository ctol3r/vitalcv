import type { auth } from '@clerk/nextjs/server';
import { fetchLaunchOpportunities, type OpportunityListPayload } from '@/lib/launch/marketplace';
import { buildClinicianMobileData, normalizeProfileCompleteness, type ClinicianMobileData } from '@/lib/mobile/clinician-state';
import {
  buildMobileOpportunityCards,
  normalizeClinicianApplications,
  normalizeMatchPayload,
  normalizeMobileTrustState,
  type MobileDashboardData,
} from '@/lib/mobile/dashboard';
import type { ClinicianProofPayload } from '@/lib/proof/types';
import { MARKETPLACE_BACKEND, buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

type AuthSession = Awaited<ReturnType<typeof auth>>;

interface WorkspacePayload {
  personProfile?: {
    npi?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    specialty?: string | null;
    stateOfPractice?: string | null;
    completeness?: number | null;
  } | null;
}

async function fetchBackendJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const response = await fetch(`${MARKETPLACE_BACKEND}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
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

function normalizeWorkspace(raw: unknown): MobileDashboardData['workspace'] {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const workspace = raw as WorkspacePayload;

  return {
    personProfile: workspace.personProfile
      ? {
          npi: workspace.personProfile.npi ?? null,
          firstName: workspace.personProfile.firstName ?? null,
          lastName: workspace.personProfile.lastName ?? null,
          specialty: workspace.personProfile.specialty ?? null,
          stateOfPractice: workspace.personProfile.stateOfPractice ?? null,
          completeness:
            typeof workspace.personProfile.completeness === 'number'
              ? workspace.personProfile.completeness
              : null,
        }
      : null,
  };
}

export async function loadClinicianMobileData(session: AuthSession): Promise<ClinicianMobileData> {
  const signedIn = Boolean(session.userId);
  const marketplaceHeaders = buildMarketplaceHeaders(session);

  const [workspaceRaw, applicationsRaw, opportunityPayload, profileCompletenessRaw, proofRaw] = await Promise.all([
    signedIn
      ? fetchBackendJson<unknown>('/api/me/workspaces', {
          headers: marketplaceHeaders,
        })
      : Promise.resolve(null),
    signedIn
      ? fetchBackendJson<unknown>('/api/clinician/applications', {
          headers: marketplaceHeaders,
        })
      : Promise.resolve(null),
    fetchLaunchOpportunities({ limit: 24 }),
    signedIn
      ? fetchBackendJson<unknown>('/api/profile/completeness', {
          headers: marketplaceHeaders,
        })
      : Promise.resolve(null),
    signedIn
      ? fetchBackendJson<ClinicianProofPayload>('/api/clinician/proof', {
          headers: marketplaceHeaders,
        })
      : Promise.resolve(null),
  ]);

  const workspace = normalizeWorkspace(workspaceRaw);
  const applications = normalizeClinicianApplications(applicationsRaw);
  const opportunities = (opportunityPayload as OpportunityListPayload | null)?.opportunities ?? [];
  const npi = workspace?.personProfile?.npi ?? null;

  const [trustRaw, trustHistoryRaw, matchRaw] = npi
    ? await Promise.all([
        fetchBackendJson<unknown>(`/api/trust-state/${encodeURIComponent(npi)}`),
        fetchBackendJson<unknown>(`/api/trust-state/${encodeURIComponent(npi)}/history?limit=12`),
        fetchBackendJson<unknown>(`/api/matcha/opportunities/${encodeURIComponent(npi)}`),
      ])
    : [null, null, null];

  const trustState = normalizeMobileTrustState(trustRaw);
  const matchPayload = normalizeMatchPayload(matchRaw);

  const base: MobileDashboardData = {
    signedIn,
    workspace,
    trustState,
    applications,
    opportunities: buildMobileOpportunityCards({
      opportunities,
      applications,
      matchPayload,
      specialty: workspace?.personProfile?.specialty ?? null,
      state: workspace?.personProfile?.stateOfPractice ?? null,
    }),
    missingForHigherMatches: matchPayload?.missingForHigherMatches ?? [],
    refreshedAt: new Date().toISOString(),
  };

  return buildClinicianMobileData({
    base,
    profileCompleteness: normalizeProfileCompleteness(profileCompletenessRaw),
    rawTrustHistory: trustHistoryRaw,
    proof: proofRaw,
  });
}
