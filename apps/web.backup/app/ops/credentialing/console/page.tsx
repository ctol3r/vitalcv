"use client";
import { useEffect, useState } from 'react';

export default function Console() {
  const [tenant, setTenant] = useState('default');
  const [score, setScore] = useState<any>();
  const [ldr, setLdr] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);

  async function load() {
    const s = await fetch('/api/compliance/psv-score/weighted?tenant=' + tenant).then((r) => r.json());
    setScore(s);
    const l = await fetch('/api/compliance/leaderboard?tenant=' + tenant + '&limit=20').then((r) =>
      r.json()
    );
    setLdr(l.rows || []);
  }

  useEffect(() => {
    load();
  }, [tenant]);

  async function drill(npi: string) {
    const d = await fetch('/api/compliance/leaderboard/' + npi).then((r) => r.json());
    setOpen({ npi, rows: d.rows });
  }

  function exportCSV() {
    const header = 'npi,pct,grade,overdue\n';
    const rows = ldr
      .map((r: any) => `${r.npi},${r.pct},${r.grade},"${(r.overdue || []).join(', ')}"`)
      .join('\n');
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credentialing-leaderboard-${tenant}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Credentialing Ops</h1>
        <button
          className="px-3 py-2 border rounded text-xs bg-white hover:bg-gray-50"
          onClick={exportCSV}
        >
          Export CSV
        </button>
      </div>
      <div className="flex gap-2 text-xs items-center">
        <input
          className="p-2 border rounded"
          placeholder="tenant id"
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
        />
        <button className="px-3 py-2 border rounded" onClick={load}>
          Load
        </button>
        <span
          className={
            'px-2 py-0.5 rounded border ' +
            (score?.grade === 'A'
              ? 'bg-green-100'
              : score?.grade === 'B'
                ? 'bg-amber-100'
                : 'bg-red-100')
          }
        >
          PSV Score: {score?.pct || 0}% ({score?.grade || '-'}) • providers: {score?.count || 0}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="p-3 border rounded">
          <div className="font-semibold mb-2">Top Overdue</div>
          <div className="space-y-2">
            {ldr.map((r: any, i: number) => (
              <div
                key={i}
                className="p-2 border rounded text-xs flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => drill(r.npi)}
              >
                <div>
                  <b>{r.npi}</b>
                </div>
                <div className="px-2 py-0.5 border rounded">{r.pct}% ({r.grade})</div>
                <div className="opacity-70">overdue: {(r.overdue || []).join(', ') || '—'}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 border rounded">
          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  document.getElementById('hm')!.classList.remove('hidden');
                } else {
                  document.getElementById('hm')!.classList.add('hidden');
                }
              }}
            />{' '}
            Show compact heatmap
          </label>
          <iframe
            id="hm"
            src="/admin/digests/heatmap"
            className="hidden w-full h-[360px] border rounded mt-2"
          />
        </div>
      </div>
      {open && (
        <div className="mt-4 p-3 border rounded text-xs">
          <div className="font-semibold mb-2">Drill-down • {open.npi}</div>
          {open.rows.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div>
                <b>{r.source.toUpperCase()}</b> •{' '}
                {r.latest_at ? new Date(r.latest_at).toLocaleDateString() : '—'}
              </div>
              <div className={'px-2 py-0.5 rounded ' + (r.ok ? 'bg-green-100' : 'bg-red-100')}>
                {r.ok ? 'OK' : 'Overdue (' + (r.days_since ?? '?') + 'd)'}
              </div>
              <button
                className="px-2 py-1 border rounded hover:bg-gray-50"
                onClick={async () => {
                  const map: any = {
                    license: '/api/verify/run?source=license',
                    board: '/api/verify/board-cert',
                    dea: '/api/verify/dea',
                    npdb: '/api/verify/npdb',
                    oig: '/api/verify/oig',
                    caqh: '/api/verify/run?source=caqh',
                    pecos: '/api/verify/run?source=pecos',
                  };
                  await fetch(map[r.source] + `&npi=${open.npi}`, { method: 'POST' });
                  drill(open.npi);
                }}
              >
                Run
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

