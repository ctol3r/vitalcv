export const dynamic = 'force-dynamic';

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, json: { raw: text } };
  }
}

function shortHash(hash?: string | null) {
  if (!hash) return '—';
  return hash.length > 12 ? `${hash.slice(0, 6)}…${hash.slice(-6)}` : hash;
}

function formatTimestamp(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default async function StatusPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  const [health, build, audit] = await Promise.all([
    getJson(`${backendUrl}/healthz`),
    getJson(`${backendUrl}/build-info`),
    getJson(`${backendUrl}/audit/summary`),
  ]);

  const overallOk = health.ok && build.ok && audit.ok;
  const overallLabel = overallOk ? 'Safe' : 'Degraded';
  const overallDetail = overallOk ? 'All systems normal' : 'Some checks need attention';

  const buildJson = build.json as any;
  const auditJson = audit.json as any;
  const healthJson = health.json as any;

  const commit = buildJson?.commit || buildJson?.gitSha;
  const builtAt = buildJson?.builtAt || buildJson?.buildTime;
  const env = buildJson?.environment;
  const version = buildJson?.version;

  const latestHash = auditJson?.latestHash || null;
  const merkleRoot = auditJson?.merkleRoot || null;
  const eventCount = typeof auditJson?.eventCount === 'number' ? auditJson.eventCount : null;
  const lastEventType = auditJson?.lastEvent?.type ?? null;
  const lastEventAt = auditJson?.lastEvent?.timestamp ?? null;

  const lastIssuanceAt = auditJson?.lastCredentialIssuanceAt ?? null;
  const lastVerificationAt = auditJson?.lastVerificationAt ?? null;
  const lastRevocationAt = auditJson?.lastRevocationAt ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">System Status</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        Live snapshot from the backend at <span className="font-mono">{backendUrl}</span>
      </p>

      <div className="mt-6 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                overallOk ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
              aria-hidden="true"
            />
            <span className="font-semibold">{overallLabel}</span>
            <span className="text-neutral-600 dark:text-neutral-300">{overallDetail}</span>
          </div>

          <div className="text-xs text-neutral-700 dark:text-neutral-300">
            <span>Build: {commit ? shortHash(String(commit)) : '—'}</span>
            <span className="mx-2">·</span>
            <span>
              Receipt:{' '}
              {latestHash || merkleRoot ? shortHash(String(latestHash || merkleRoot)) : '—'}
            </span>
            <span className="mx-2">·</span>
            <span>
              Last event: {lastEventType ? String(lastEventType) : '—'} (
              {formatTimestamp(lastEventAt)})
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <section className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Health</h2>
            <span className={health.ok ? 'text-emerald-600' : 'text-rose-600'}>
              {health.ok ? 'OK' : `HTTP ${health.status}`}
            </span>
          </div>

          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Status</dt>
              <dd className="font-mono">{String(healthJson?.status ?? '—')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Checked</dt>
              <dd className="font-mono">{formatTimestamp(healthJson?.timestamp ?? null)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Latency</dt>
              <dd className="font-mono">
                {healthJson?.latencyMs != null ? `${healthJson.latencyMs}ms` : '—'}
              </dd>
            </div>
          </dl>

          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-neutral-600 dark:text-neutral-300">
              Raw JSON
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
              {JSON.stringify(health.json, null, 2)}
            </pre>
          </details>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Build Info</h2>
            <span className={build.ok ? 'text-emerald-600' : 'text-rose-600'}>
              {build.ok ? 'OK' : `HTTP ${build.status}`}
            </span>
          </div>

          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Commit</dt>
              <dd className="font-mono">{commit ? shortHash(String(commit)) : '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Built</dt>
              <dd className="font-mono">{formatTimestamp(builtAt ?? null)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Env</dt>
              <dd className="font-mono">{env ? String(env) : '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Version</dt>
              <dd className="font-mono">{version ? String(version) : '—'}</dd>
            </div>
          </dl>

          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-neutral-600 dark:text-neutral-300">
              Raw JSON
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
              {JSON.stringify(build.json, null, 2)}
            </pre>
          </details>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Audit Summary</h2>
            <span className={audit.ok ? 'text-emerald-600' : 'text-rose-600'}>
              {audit.ok ? 'OK' : `HTTP ${audit.status}`}
            </span>
          </div>

          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Events</dt>
              <dd className="font-mono">{eventCount != null ? String(eventCount) : '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Latest receipt</dt>
              <dd className="font-mono">{latestHash ? shortHash(String(latestHash)) : '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-300">Merkle root</dt>
              <dd className="font-mono">{merkleRoot ? shortHash(String(merkleRoot)) : '—'}</dd>
            </div>
          </dl>

          <div className="mt-4 text-xs text-neutral-700 dark:text-neutral-300">
            <div className="font-semibold">Recent activity</div>
            <ul className="mt-2 space-y-1">
              <li>Issuance: {formatTimestamp(lastIssuanceAt)}</li>
              <li>Verification: {formatTimestamp(lastVerificationAt)}</li>
              <li>Revocation: {formatTimestamp(lastRevocationAt)}</li>
            </ul>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-neutral-600 dark:text-neutral-300">
              Raw JSON
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
              {JSON.stringify(audit.json, null, 2)}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
