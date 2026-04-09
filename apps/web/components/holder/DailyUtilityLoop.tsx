'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, BriefcaseBusiness, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import type { ClinicianMobileData } from '@/lib/mobile/clinician-state';

export function DailyUtilityLoop({ npi }: { npi: string }) {
  const [data, setData] = useState<ClinicianMobileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const res = await fetch('/api/mobile/dashboard');
      if (res.ok) {
        const json = await res.json() as ClinicianMobileData;
        setData(json);
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [npi]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!data) return null;

  const { notifications = [], availableOpportunities = [] } = data;
  const recentUpdates = notifications.slice(0, 3);
  const topRoles = availableOpportunities.slice(0, 3);

  if (recentUpdates.length === 0 && topRoles.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Updates Panel */}
      <section className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Live Updates</p>
            <h3 className="text-lg font-medium text-foreground mt-1">Recent Changes</h3>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              void loadData();
            }}
            className="p-2 rounded-full hover:bg-zinc-800 transition text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3">
          {recentUpdates.length > 0 ? (
            recentUpdates.map((update) => (
              <div key={update.id} className="flex gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{update.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{update.body}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-zinc-600">
                    {new Date(update.occurredAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500 p-4 text-center">No recent changes.</p>
          )}
        </div>
      </section>

      {/* Opportunities Panel */}
      <section className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Matched Roles</p>
            <h3 className="text-lg font-medium text-foreground mt-1">Available Opportunities</h3>
          </div>
        </div>

        <div className="space-y-3">
          {topRoles.length > 0 ? (
            topRoles.map((role) => (
              <Link
                key={role.id}
                href={`/explore?role=${role.id}`}
                className="group flex gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4 hover:border-emerald-500/30 hover:bg-emerald-950/10 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-emerald-400 group-hover:bg-emerald-500/20">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-200 group-hover:text-emerald-300">{role.title}</p>
                  <p className="truncate text-xs text-zinc-400">{role.organizationName} · {role.remote ? 'Remote' : role.state}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                      {role.match?.band ?? 'L0'} Match
                    </span>
                  </div>
                </div>
                <div className="flex items-center text-zinc-500 group-hover:text-emerald-400">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-zinc-800/60 border-dashed p-6 text-center">
              <p className="text-sm text-zinc-400 mb-3">Upload evidence to unlock matched opportunities.</p>
              <Link
                href="/documents"
                className="inline-flex items-center justify-center rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
              >
                Upload CV
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
