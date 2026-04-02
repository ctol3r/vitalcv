'use client';

import type { ActivePersona, WorkspaceList } from '@/types/workspace';
import { cn } from '@/lib/utils';
import { ChevronDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const PERSONA_LABEL: Record<ActivePersona, string> = {
  CLINICIAN: 'Clinician',
  VERIFIER: 'Employer',
  BOTH: 'Both',
};

const PERSONA_BADGE: Record<ActivePersona, string> = {
  CLINICIAN: 'bg-vt-success/15 text-vt-success ring-vt-success/30',
  VERIFIER: 'bg-vt-info/15 text-vt-info ring-vt-info/30',
  BOTH: 'bg-vt-brand-primary/15 text-vt-brand-primary ring-vt-brand-primary/30',
};

export function WorkspaceSwitcher() {
  const [workspace, setWorkspace] = useState<WorkspaceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingPersona, setPendingPersona] = useState<ActivePersona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  async function loadWorkspace(): Promise<WorkspaceList | null> {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/me/workspaces', {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          setWorkspace(null);
          return null;
        }
        throw new Error(`Workspace fetch failed with HTTP ${response.status}`);
      }

      const payload = await response.json() as WorkspaceList;
      setWorkspace(payload);
      return payload;
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Connection interrupted. Retrying securely.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitch(persona: ActivePersona) {
    if (!workspace || pendingPersona || persona === workspace.activePersona) {
      setMenuOpen(false);
      return;
    }

    try {
      setPendingPersona(persona);
      setError(null);

      const response = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ persona }),
      });

      if (!response.ok) {
        throw new Error(`Workspace switch failed with HTTP ${response.status}`);
      }

      await loadWorkspace();
      setMenuOpen(false);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : 'Workspace switch interrupted. Please try again.');
    } finally {
      setPendingPersona(null);
    }
  }

  if (loading || !workspace) {
    return null;
  }

  return (
    <div
      ref={shellRef}
      className="pointer-events-none fixed right-4 top-20 z-40 sm:right-6"
    >
      <section className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/95 p-4 text-vt-neutral-100 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="heading-sm text-vt-neutral-100">Workspace</p>
            <p className="body-sm mt-1 text-vt-neutral-200">
              {workspace.memberships.length > 0
                ? `${workspace.memberships.length} org workspace${workspace.memberships.length === 1 ? '' : 's'} available`
                : 'Personal identity workspace'}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ring-1',
              PERSONA_BADGE[workspace.activePersona],
            )}
          >
            {PERSONA_LABEL[workspace.activePersona]}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-between rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base px-3 py-2.5 text-left body-sm text-vt-neutral-100 transition hover:border-vt-brand-primary/40 hover:text-foreground"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Switch active workspace persona"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>{pendingPersona ? `Switching to ${PERSONA_LABEL[pendingPersona]}...` : 'Switch persona'}</span>
            {pendingPersona ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ChevronDown className={cn('h-4 w-4 transition-transform', menuOpen && 'rotate-180')} aria-hidden="true" />
            )}
          </button>
          <Link
            href="/workspace/switch"
            className="inline-flex items-center rounded-xl border border-vt-neutral-800 px-3 py-2.5 body-sm text-vt-neutral-200 transition hover:border-vt-brand-primary/40 hover:text-foreground"
          >
            View
          </Link>
        </div>

        {menuOpen ? (
          <div
            role="menu"
            aria-label="Workspace personas"
            className="mt-3 space-y-2 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base p-2"
          >
            {workspace.canSwitchTo.map((persona) => {
              const active = persona === workspace.activePersona;
              return (
                <button
                  key={persona}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left body-sm transition',
                    active
                      ? 'bg-vt-surface-ops-raised text-white'
                      : 'text-vt-neutral-200 hover:bg-vt-surface-ops-raised hover:text-foreground',
                  )}
                  disabled={pendingPersona !== null}
                  onClick={() => void handleSwitch(persona)}
                >
                  <span>{PERSONA_LABEL[persona]}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-vt-neutral-800">
                    {active ? 'Active' : 'Available'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 body-sm text-vt-warning">{error}</p>
        ) : null}
      </section>
    </div>
  );
}
