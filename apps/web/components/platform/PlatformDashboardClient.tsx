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
    <div className="mz-glass rounded-[12px] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold tracking-tight text-[var(--ink-900)]">{title}</span>
        <span className={`mz-chip ${ok ? 'mz-chip-ok' : 'mz-chip-p0'}`}>
          <span className="mz-gl" aria-hidden="true" />
          {ok ? 'Healthy' : 'Drift'}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
            <dt className="mz-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-400)]">{k}</dt>
            <dd className="mz-mono truncate text-[var(--ink-800)]">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-[11.5px] leading-5 text-[var(--ink-500)]">{note}</p>}
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
    <main className="mz mz-paper mz-persona-admin mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mz-eyebrow">Production · Platform</div>
          <h1 className="mz-h1 mt-3 flex items-center gap-3">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: healthy ? 'var(--ok)' : 'var(--p0)' }}
            />
            {healthy ? 'Platform Healthy' : 'Deployment Drift'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--ink-600)]">
            Every service agrees on repo, branch, commit, age, health, and environment — or one card turns red.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="mz-btn mz-btn-ghost mz-btn-sm disabled:opacity-50"
        >
          {refreshing ? 'Checking…' : 'Refresh'}
        </button>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <h2 className="mz-eyebrow">Open incidents</h2>
          <ul className="mt-3 space-y-2">
            {report.incidents.map((i, idx) => (
              <li
                key={idx}
                className="rounded-[8px] border px-4 py-3 text-[12.5px]"
                style={{
                  borderColor: i.severity === 'incident' ? 'var(--p0-rule)' : 'var(--watch-rule)',
                  background: i.severity === 'incident' ? 'var(--p0-bg)' : 'var(--watch-bg)',
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`mz-chip ${i.severity === 'incident' ? 'mz-chip-p0' : 'mz-chip-watch'}`}>
                    <span className="mz-gl" aria-hidden="true" />
                    {i.severity}
                  </span>
                  <span className="mz-mono text-[var(--ink-800)]">{i.service} · {i.field}</span>
                  <span className="text-[var(--ink-500)]">expected {i.expected}, got {i.actual}</span>
                </div>
                <p className="mt-1 text-[var(--ink-600)]">{i.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mz-mono mt-8 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-400)]">
        generated {new Date(report.generatedAt).toLocaleString()} · auto-refresh 30s · detect-only
      </footer>
    </main>
  );
}
