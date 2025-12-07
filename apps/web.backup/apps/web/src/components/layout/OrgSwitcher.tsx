'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { getJSON } from '@/components/api/http';

interface OrgMembershipDto {
  orgId: string;
  name: string;
  role: string;
}

interface OrgResponse {
  orgs: OrgMembershipDto[];
}

export function OrgSwitcher() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgMembershipDto[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadOrgs = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getJSON<OrgResponse>('/api/me/orgs');
        if (!mounted) return;

        const memberships = data?.orgs ?? [];
        setOrgs(memberships);

        if (memberships.length === 0) {
          setActiveOrgId(null);
          return;
        }

        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('activeOrgId') : null;
        const initial = stored && memberships.some((org) => org.orgId === stored)
          ? stored
          : memberships[0].orgId;

        setActiveOrgId(initial);
        persistActiveOrgId(initial);
      } catch (err) {
        console.error('Failed to load organizations', err);
        if (mounted) {
          setError('Unable to load organizations');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadOrgs();
    return () => {
      mounted = false;
    };
  }, []);

  const activeOrg = useMemo(() => orgs.find((org) => org.orgId === activeOrgId) ?? orgs[0], [orgs, activeOrgId]);

  const handleSelect = (orgId: string) => {
    setActiveOrgId(orgId);
    persistActiveOrgId(orgId);
    router.refresh();
  };

  const srLabel = activeOrg
    ? `Active organization ${activeOrg.name} with ${formatRole(activeOrg.role)} access`
    : 'No organization selected';

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="inline-flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading orgs…</span>
      </Button>
    );
  }

  if (error) {
    return (
      <Button variant="destructive" size="sm" onClick={() => window.location.reload()}>
        Retry loading orgs
      </Button>
    );
  }

  if (!activeOrg) {
    return (
      <div className="text-sm text-muted-foreground" aria-live="polite">
        No organizations available
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2"
          aria-label={`Switch organization. ${srLabel}`}
        >
          <Building2 className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">Org: {activeOrg.name}</span>
          <Badge variant="secondary" className="text-[11px] uppercase tracking-wide">
            {formatRole(activeOrg.role)}
          </Badge>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72" sideOffset={8}>
        <div className="px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
          Select which organization context to use across dashboards.
        </div>
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.orgId}
            onSelect={(event) => {
              event.preventDefault();
              handleSelect(org.orgId);
            }}
            className="flex items-center justify-between gap-2"
          >
            <div>
              <p className="text-sm font-medium">{org.name}</p>
              <p className="text-xs text-muted-foreground">{formatRole(org.role)}</p>
            </div>
            {org.orgId === activeOrgId && <Check className="h-4 w-4 text-primary" aria-label="Active" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
      <span className="sr-only" aria-live="polite">
        {srLabel}
      </span>
    </DropdownMenu>
  );
}

function formatRole(role: string) {
  if (!role) return 'viewer';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function persistActiveOrgId(orgId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('activeOrgId', orgId);
  document.cookie = `activeOrgId=${orgId}; path=/; SameSite=Lax`;
}
