'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeConfig, getTheme, defaultTheme } from '../../config/themes';

interface TenantContextType {
  tenant: {
    id: string;
    slug: string;
    name: string;
    orgId?: string;
  } | null;
  theme: ThemeConfig;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  theme: defaultTheme,
  loading: true,
});

export function useTenant() {
  return useContext(TenantContext);
}

export default function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantContextType['tenant']>(null);
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTenant() {
      try {
        // Fetch org metadata
        // In a real scenario, we might parse the domain from window.location here as well
        // but middleware passes it too. For now, we fetch from API which sees the header/host.
        const res = await fetch('/api/org/by-domain');
        if (res.ok) {
          const data = await res.json();
          setTenant(data);
          setTheme(getTheme(data.slug));
        } else {
          // Fallback to default or handle error
          console.warn('Failed to fetch tenant metadata');
          setTheme(defaultTheme);
        }
      } catch (error) {
        console.error('Error fetching tenant:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, theme, loading }}>
      {children}
    </TenantContext.Provider>
  );
}















