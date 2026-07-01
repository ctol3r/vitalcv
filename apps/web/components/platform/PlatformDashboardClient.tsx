'use client';

/**
 * Founder Dashboard — the always-on view of platform deployment integrity.
 * Every production service shows a green card when it agrees with the canonical
 * config; any drift turns its card red and lists the incident. Auto-refreshes.
 */
import * as React from 'react';
import type { IntegrityReport, ServiceReport } from '@/lib/platform/deployment-integrity';

const ROLE_LABEL: Record<string, string> = { web: 'Web', api: 'API', database: 'Database' };

function ago(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function Card({
  title,
  ok,
  rows,
  note,
}: {
  title: string;
  ok: boolean;
  rows: Array<[string, string]>;
  note?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: ok ? 'rgba(52,211,153,0.35)' : 'rgba(244,63,94,0.45)',
        background: ok ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.08)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold tracking-tight text-white">{title}</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{
            color: ok ? '#6ee7b7' : '#fda4af',
            background: ok ? 'rgba(16,185,129,0.14)' : 'rgba(244,63,94,0.16)',
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? '#34d399' : '#fb7185' }} />
          {ok ? 'Healthy' : 'Drift'}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
            <dt className="text-white/45">{k}</dt>
            <dd className="font-mono text-white/85 truncate">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-[11.5px] leading-5 text-white/55">{note}</p>}
    </div>
  );
}

function serviceRows(s: ServiceReport): Array<[string, string]> {
  if (s.role === 'database') {
    return [
      ['Status', s.deployStatus ?? '—'],
      ['Age', ago(s.ageHours)],
      ['Builder', s.builder ?? '—'],
    ];
  }
  return [
    ['Branch', s.branch ?? '—'],
    ['Commit', s.commitShort ?? '—'],
    ['Deploy', s.deployStatus ?? '—'],
    ['Age', ago(s.ageHours)],
    ['Health', s.healthStatus],
  ];
}

export default function PlatformDashboardClient({ initialReport }: { initialReport: IntegrityReport }) {
  const [report, setReport] = React.useState<IntegrityReport>(initialReport);
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/platform', { cache: 'no-store' });
      if (res.ok) setReport((await res.json()) as IntegrityReport);
    } catch {
      /* keep last good report */
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  const healthy = report.overall === 'healthy';

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">Production · Platform</div>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight text-white">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: healthy ? '#34d399' : '#fb7185', boxShadow: `0 0 0 4px ${healthy ? 'rgba(52,211,153,0.18)' : 'rgba(251,113,133,0.18)'}` }}
            />
            {healthy ? 'Platform Healthy' : 'Deployment Drift'}
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Every service agrees on repo, branch, commit, age, health, and environment — or one card turns red.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="rounded-lg border border-white/15 px-3 py-2 text-[12px] font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
        >
          {refreshing ? 'Checking…' : 'Refresh'}
        </button>
      </header>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {report.services.map((s) => (
          <Card key={s.name} title={`${ROLE_LABEL[s.role] ?? s.name}`} ok={s.ok} rows={serviceRows(s)} note={s.domain ?? undefined} />
        ))}
        <Card
          title="GitHub"
          ok={report.githubSynced}
          rows={[
            ['Repo', report.expected.repo],
            ['main HEAD', report.githubMainSha?.slice(0, 9) ?? 'unknown'],
          ]}
          note={report.githubSynced ? 'main HEAD reachable' : 'Could not read main HEAD'}
        />
        <Card
          title="Railway"
          ok={report.railwayReachable}
          rows={[
            ['Project', 'inspiring-reflection'],
            ['Env', report.expected.environment],
          ]}
          note={report.railwayReachable ? 'deployment metadata reachable' : 'Set RAILWAY_API_TOKEN for full drift detection'}
        />
      </section>

      {report.incidents.length > 0 && (
        <section className="mt-7">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/50">Open incidents</h2>
          <ul className="mt-3 space-y-2">
            {report.incidents.map((i, idx) => (
              <li
                key={idx}
                className="rounded-xl border px-4 py-3 text-[12.5px]"
                style={{
                  borderColor: i.severity === 'incident' ? 'rgba(244,63,94,0.35)' : 'rgba(245,158,11,0.35)',
                  background: i.severity === 'incident' ? 'rgba(244,63,94,0.06)' : 'rgba(245,158,11,0.06)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: i.severity === 'incident' ? '#fda4af' : '#fcd34d', background: i.severity === 'incident' ? 'rgba(244,63,94,0.16)' : 'rgba(245,158,11,0.16)' }}
                  >
                    {i.severity}
                  </span>
                  <span className="font-mono text-white/85">{i.service} · {i.field}</span>
                  <span className="text-white/45">expected {i.expected}, got {i.actual}</span>
                </div>
                <p className="mt-1 text-white/60">{i.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
        generated {new Date(report.generatedAt).toLocaleString()} · auto-refresh 30s · detect-only
      </footer>
    </main>
  );
}
