'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface RoleUxConfig {
  actionBar?: {
    actions: Array<{ id: string; label: string; href: string; icon?: string }>;
  };
  terminology?: Record<string, string>;
  notifications?: {
    channels: string[];
    subscriptions: string[];
  };
  navigationGuards?: string[];
  errorLanguage?: Record<string, string>;
  accessibility?: Record<string, unknown>;
}

interface RoleUxContextValue {
  role: string;
  config: RoleUxConfig | null;
  loading: boolean;
  error: string | null;
  restrictedPath: string | null;
  formatError: (code: string, fallback?: string) => string;
}

const RoleUXContext = createContext<RoleUxContextValue>({
  role: 'clinician',
  config: null,
  loading: true,
  error: null,
  restrictedPath: null,
  formatError: (_code, fallback) => fallback ?? 'Something went wrong.',
});

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

const DEFAULT_ROLE = process.env.NEXT_PUBLIC_DEFAULT_ROLE ?? 'clinician';

const ROLE_ROUTE_HINTS: Array<{ role: string; matcher: RegExp }> = [
  { role: 'admin', matcher: /^\/(trust-anchors|observability-grid|workforce-grid|capacity|usage)/ },
  { role: 'issuer', matcher: /^\/issuer/ },
  { role: 'recruiter', matcher: /^\/recruiter/ },
  { role: 'verifier', matcher: /^\/verifier/ },
  { role: 'clinician', matcher: /^\/(credential-fabric|fusion|wallet|interop|monitoring|rules)/ },
];

export function RoleUXProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string>(DEFAULT_ROLE);
  const [config, setConfig] = useState<RoleUxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restrictedPath, setRestrictedPath] = useState<string | null>(null);

  useEffect(() => {
    const hint = ROLE_ROUTE_HINTS.find((entry) => entry.matcher.test(pathname ?? ''));
    if (hint && hint.role !== role) {
      setRole(hint.role);
    }
  }, [pathname, role]);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/ux/config/${role}`);
        if (!res.ok) {
          throw new Error(`Config request failed (${res.status})`);
        }
        const payload = (await res.json()) as { uxProfile: RoleUxConfig };
        if (!cancelled) {
          setConfig(payload.uxProfile ?? null);
        }
      } catch (err) {
        console.error('[RoleUX] config load failed', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load UX profile');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (!config || !pathname) {
      setRestrictedPath(null);
      return;
    }
    const guards = config.navigationGuards ?? [];
    const blocked = guards.some((guard) => pathname.startsWith(guard));
    setRestrictedPath(blocked ? pathname : null);
  }, [config, pathname]);

  const formatError = useCallback(
    (code: string, fallback?: string) => {
      if (config?.errorLanguage && code in config.errorLanguage) {
        return String(config.errorLanguage[code]);
      }
      if (config?.errorLanguage?.generic) {
        return String(config.errorLanguage.generic);
      }
      return fallback ?? 'We hit a snag. Try again.';
    },
    [config],
  );

  const value = useMemo<RoleUxContextValue>(
    () => ({
      role,
      config,
      loading,
      error,
      restrictedPath,
      formatError,
    }),
    [role, config, loading, error, restrictedPath, formatError],
  );

  return <RoleUXContext.Provider value={value}>{children}</RoleUXContext.Provider>;
}

export function useRoleUX() {
  return useContext(RoleUXContext);
}

