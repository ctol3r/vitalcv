'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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

export function RoleProvider({
  children,
  initialUserId,
  initialClerkRole,
}: {
  children: ReactNode;
  initialUserId: string | null;
  initialClerkRole: string | null;
}) {
  const [workspace, setWorkspace] = useState<WorkspaceList | null>(null);
  const [isLoaded, setIsLoaded] = useState(!initialUserId);

  async function loadWorkspace() {
    if (!initialUserId) {
      setWorkspace(null);
      setIsLoaded(true);
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
      setIsLoaded(true);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [initialUserId]);

  const value = useMemo<RoleContextValue>(() => {
    const derived = deriveRoleModel(initialUserId, initialClerkRole, workspace);

    return {
      isLoaded,
      isSignedIn: derived.isSignedIn,
      clerkRole: initialClerkRole,
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
  }, [initialClerkRole, initialUserId, isLoaded, workspace]);

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleContext(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRoleContext must be used within a RoleProvider.');
  }

  return context;
}
