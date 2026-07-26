'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import type { ActivePersona, WorkspaceList } from '@/types/workspace';

export type MarketplaceRole = 'guest' | 'clinician' | 'employer';

export interface RoleContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  clerkRole: string | null;
  persona: ActivePersona | null;
  role: MarketplaceRole;
  landingRoute: string;
  isClinician: boolean;
  isEmployer: boolean;
  clinicianNpi: string | null;
  employerOrgId: string | null;
  workspace: WorkspaceList | null;
  refresh: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function inferPersona(
  workspace: WorkspaceList | null,
  clerkRole: string | null,
): ActivePersona | null {
  if (workspace?.activePersona) {
    return workspace.activePersona;
  }

  if (clerkRole === 'VERIFIER') {
    return 'VERIFIER';
  }

  if (clerkRole === 'CLINICIAN') {
    return 'CLINICIAN';
  }

  return null;
}

function deriveRoleModel(
  userId: string | null,
  clerkRole: string | null,
  workspace: WorkspaceList | null,
) {
  const persona = inferPersona(workspace, clerkRole);
  const isSignedIn = Boolean(userId);
  const hasClinicianProfile = Boolean(workspace?.personProfile?.npi);
  const isEmployerPersona = persona === 'VERIFIER' || persona === 'BOTH' || clerkRole === 'VERIFIER';
  const isClinicianPersona = persona === 'CLINICIAN' || persona === 'BOTH' || clerkRole === 'CLINICIAN' || hasClinicianProfile;
  const role: MarketplaceRole = !isSignedIn
    ? 'guest'
    : isEmployerPersona && persona === 'VERIFIER'
      ? 'employer'
      : 'clinician';

  return {
    persona,
    role,
    isSignedIn,
    isClinician: isSignedIn && isClinicianPersona,
    isEmployer: isSignedIn && isEmployerPersona,
    clinicianNpi: workspace?.personProfile?.npi ?? null,
    employerOrgId: workspace?.activeOrgId ?? null,
    landingRoute: !isSignedIn
      ? '/sign-in'
      : role === 'employer'
        ? '/employer/dashboard'
        : '/holder/home',
  };
}

/**
 * Wave 0.2 follow-up: the session is resolved on the CLIENT (Clerk's useAuth),
 * never seeded by a root-layout `auth()` call. The old server seed forced
 * every route — the whole public marketing site — into per-request dynamic
 * rendering the moment Clerk was correctly enabled at build time, destroying
 * the bounded shared caching (#680) on pages that must stay static. A static
 * prerender can only ever carry the guest state anyway; the truth arrives at
 * hydration and this provider converges to it.
 */
function RoleProviderInner({
  children,
  userId,
  clerkRole,
  sessionLoaded,
}: {
  children: ReactNode;
  userId: string | null;
  clerkRole: string | null;
  sessionLoaded: boolean;
}) {
  const [workspace, setWorkspace] = useState<WorkspaceList | null>(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(!userId);

  const loadWorkspace = useCallback(async () => {
    if (!userId) {
      setWorkspace(null);
      setWorkspaceLoaded(true);
      return;
    }

    try {
      const response = await fetch('/api/me/workspaces', {
        cache: 'no-store',
      });

      if (!response.ok) {
        setWorkspace(null);
        return;
      }

      const payload = await response.json() as WorkspaceList;
      setWorkspace(payload);
    } catch {
      setWorkspace(null);
    } finally {
      setWorkspaceLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const value = useMemo<RoleContextValue>(() => {
    const derived = deriveRoleModel(userId, clerkRole, workspace);

    return {
      isLoaded: sessionLoaded && workspaceLoaded,
      isSignedIn: derived.isSignedIn,
      clerkRole,
      persona: derived.persona,
      role: derived.role,
      landingRoute: derived.landingRoute,
      isClinician: derived.isClinician,
      isEmployer: derived.isEmployer,
      clinicianNpi: derived.clinicianNpi,
      employerOrgId: derived.employerOrgId,
      workspace,
      refresh: loadWorkspace,
    };
  }, [clerkRole, loadWorkspace, sessionLoaded, userId, workspace, workspaceLoaded]);

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

interface RoleProviderProps {
  children: ReactNode;
  /** Optional pre-hydration placeholder (dynamic trees may pass one); the
   *  Clerk client session supersedes it the moment it loads. */
  initialUserId: string | null;
  initialClerkRole: string | null;
}

function ClerkRoleProvider({ children, initialUserId, initialClerkRole }: RoleProviderProps) {
  // useAuth reads ClerkProvider's CLIENT context — it never touches request
  // state, so statically-rendered pages stay static.
  const { userId, isLoaded } = useAuth();
  return (
    <RoleProviderInner
      userId={isLoaded ? (userId ?? null) : initialUserId}
      clerkRole={initialClerkRole}
      sessionLoaded={isLoaded}
    >
      {children}
    </RoleProviderInner>
  );
}

function StaticRoleProvider({ children, initialUserId, initialClerkRole }: RoleProviderProps) {
  return (
    <RoleProviderInner userId={initialUserId} clerkRole={initialClerkRole} sessionLoaded>
      {children}
    </RoleProviderInner>
  );
}

// Build-time constant, so the choice is stable for the life of the bundle:
// keyless builds (local prod builds, e2e) never call Clerk hooks at all.
export const RoleProvider = CLERK_PROVIDER_ENABLED ? ClerkRoleProvider : StaticRoleProvider;

export function useRoleContext(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRoleContext must be used within a RoleProvider.');
  }

  return context;
}
