'use client';

import { ThemeProvider } from 'next-themes';
import { SWRConfig } from 'swr';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import TenantProvider from './providers/TenantProvider';
import { swrConfig } from '@/lib/swr/fetcher';

type Role = 'holder' | 'issuer' | 'verifier';
type RoleCtx = {
  role: Role;
  setRole: (r: Role) => void;
  roles: Role[];
  setRoles: (r: Role[]) => void;
};
const RoleContext = createContext<RoleCtx | null>(null);
export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within Providers');
  return ctx;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('holder');
  const [roles, setRoles] = useState<Role[]>(['holder', 'issuer', 'verifier']);

  useEffect(() => {
    try {
      const savedRole = localStorage.getItem('vitalcv_role') as Role | null;
      const savedRoles = JSON.parse(
        localStorage.getItem('vitalcv_roles') || '["holder","issuer","verifier"]',
      ) as Role[];
      if (savedRole) setRole(savedRole);
      if (savedRoles?.length) setRoles(savedRoles);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('vitalcv_role', role);
    localStorage.setItem('vitalcv_roles', JSON.stringify(roles));
  }, [role, roles]);

  const value = useMemo(() => ({ role, setRole, roles, setRoles }), [role, roles]);

  return (
    <TenantProvider>
      <SWRConfig value={swrConfig}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
        </ThemeProvider>
      </SWRConfig>
    </TenantProvider>
  );
}

