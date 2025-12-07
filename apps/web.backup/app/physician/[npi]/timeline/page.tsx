"use client";
/**
 * Batch 69: Physician Timeline — License Chip + Refresh
 * Batch 71: Board + DEA chips with within-window checks
 * Shows state board license with green check when status=active and expires_at in future
 * Refresh button forces cache update
 */

import { useEffect, useState } from 'react';

export default function Timeline({ params }: { params: { npi: string } }) {
  const [lic, setLic] = useState<any>();
  const [st, setSt] = useState('CA');
  const [num, setNum] = useState('A12345');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [psvSummary, setPsvSummary] = useState<Record<string, boolean>>({});
  const [windowStatus, setWindowStatus] = useState<Record<string, { ok: boolean; days_since: number | null; latest_at: string | null }>>({});
  const [runningPSV, setRunningPSV] = useState<string | null>(null);
  const [weightedScore, setWeightedScore] = useState<{ pct: number; grade: string } | null>(null);
  const [monitoringEvents, setMonitoringEvents] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/verify/license?state=${st}&number=${num}&npi=${params.npi}`);
      setLic(await r.json());
    } catch (e) {
      console.error('Failed to load license:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadWindows() {
    try {
      const r = await fetch(`/api/compliance/windows?npi=${encodeURIComponent(params.npi)}`);
      const data = await r.json();
      const windows: Record<string, { ok: boolean; days_since: number | null; latest_at: string | null }> = {};
      Object.entries(data.sources || {}).forEach(([k, v]: [string, any]) => {
        windows[k] = { ok: v.ok, days_since: v.days_since, latest_at: v.latest_at };
      });
      setWindowStatus(windows);
      // Update PSV summary
      const summary: Record<string, boolean> = {};
      ['license', 'board', 'dea', 'npdb', 'oig'].forEach(src => {
        summary[src] = windows[src]?.ok || false;
      });
      setPsvSummary(summary);
    } catch (e) {
      console.error('Failed to load windows:', e);
    }
  }

  async function loadWeightedScore() {
    try {
      const r = await fetch(`/api/compliance/psv-score/weighted?npi=${encodeURIComponent(params.npi)}`);
      const data = await r.json();
      setWeightedScore({ pct: data.pct || 0, grade: data.grade || 'C' });
    } catch (e) {
      console.error('Failed to load weighted score:', e);
    }
  }

  async function loadMonitoringEvents() {
    try {
      const r = await fetch(`/api/audit?npi=${encodeURIComponent(params.npi)}&source=monitoring`);
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) {
          setMonitoringEvents(data);
        }
      }
    } catch (e) {
      console.error('Failed to load monitoring events:', e);
    }
  }

  useEffect(() => {
    load();
    loadWindows();
    loadWeightedScore();
    loadMonitoringEvents();
  }, [st, num, params.npi]);

  async function refetch() {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/verify/license/refresh?state=${st}&number=${num}`, { method: 'POST' });
      setLic(await r.json());
    } catch (e) {
      console.error('Failed to refresh license:', e);
    } finally {
      setRefreshing(false);
    }
  }

  const ok =
    !!lic?.status &&
    String(lic.status).toLowerCase() === 'active' &&
    (!lic.expires_at || new Date(lic.expires_at) > new Date());

  async function runPSV(source: 'board-cert' | 'dea' | 'npdb' | 'oig') {
    setRunningPSV(source);
    try {
      const r = await fetch(`/api/verify/${source}?npi=${encodeURIComponent(params.npi)}`, { method: 'POST' });
      const data = await r.json();
      if (data.ok) {
        // Reload window status and weighted score
        await loadWindows();
        await loadWeightedScore();
      }
    } catch (e) {
      console.error(`Failed to run ${source} PSV:`, e);
    } finally {
      setRunningPSV(null);
    }
  }

  const allGreen = Object.values(psvSummary).every(v => v);
  const boardOk = windowStatus.board?.ok || false;
  const deaOk = windowStatus.dea?.ok || false;
  const licenseOk = windowStatus.license?.ok || false;
  const npdbOk = windowStatus.npdb?.ok || false;
  const oigOk = windowStatus.oig?.ok || false;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'B':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'C':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Physician Timeline</h1>
          <p className="text-sm opacity-70 mt-1">NPI: {params.npi}</p>
        </div>
        {weightedScore && (
          <a
            href={`/compliance?npi=${params.npi}`}
            className={`px-4 py-2 border rounded-md font-semibold cursor-pointer hover:opacity-80 transition-opacity ${getGradeColor(weightedScore.grade)}`}
            title="Weighted PSV Score - Click for details. Scores are based on source weights: License (30), Board (20), DEA (20), NPDB (15), OIG (10), CAQH (3), PECOS (2)."
          >
            {weightedScore.grade} {weightedScore.pct}%
          </a>
        )}
      </div>

      {/* PSV Chips: License, Board, DEA */}
      <div className="mt-4 flex gap-2 items-center flex-wrap">
        <span className="text-xs font-semibold">PSV Status:</span>

        {/* License Chip */}
        <button
          className={`px-3 py-1 rounded text-xs font-medium border ${
            licenseOk
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'bg-red-100 border-red-300 text-red-800'
          }`}
          title={windowStatus.license?.latest_at ? `Last verified: ${new Date(windowStatus.license.latest_at).toLocaleDateString()}` : 'Not verified'}
        >
          LICENSE {licenseOk ? '✅' : '⚠'}
        </button>

        {/* Board Chip */}
        <button
          onClick={() => runPSV('board-cert')}
          disabled={runningPSV === 'board-cert'}
          className={`px-3 py-1 rounded text-xs font-medium border ${
            boardOk
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'bg-red-100 border-red-300 text-red-800'
          } ${runningPSV === 'board-cert' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
          title={windowStatus.board?.latest_at ? `Last verified: ${new Date(windowStatus.board.latest_at).toLocaleDateString()}` : 'Click to verify'}
        >
          BOARD {boardOk ? '✅' : '⚠'} {runningPSV === 'board-cert' ? '...' : ''}
        </button>

        {/* DEA Chip */}
        <button
          onClick={() => runPSV('dea')}
          disabled={runningPSV === 'dea'}
          className={`px-3 py-1 rounded text-xs font-medium border ${
            deaOk
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'bg-red-100 border-red-300 text-red-800'
          } ${runningPSV === 'dea' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
          title={windowStatus.dea?.latest_at ? `Last verified: ${new Date(windowStatus.dea.latest_at).toLocaleDateString()}` : 'Click to verify'}
        >
          DEA {deaOk ? '✅' : '⚠'} {runningPSV === 'dea' ? '...' : ''}
        </button>

        {/* NPDB Chip */}
        <button
          onClick={() => runPSV('npdb')}
          disabled={runningPSV === 'npdb'}
          className={`px-3 py-1 rounded text-xs font-medium border ${
            npdbOk
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'bg-red-100 border-red-300 text-red-800'
          } ${runningPSV === 'npdb' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
          title={windowStatus.npdb?.latest_at ? `Last verified: ${new Date(windowStatus.npdb.latest_at).toLocaleDateString()}` : 'Click to verify'}
        >
          NPDB {npdbOk ? '✅' : '⚠'} {runningPSV === 'npdb' ? '...' : ''}
        </button>

        {/* OIG Chip */}
        <button
          onClick={() => runPSV('oig')}
          disabled={runningPSV === 'oig'}
          className={`px-3 py-1 rounded text-xs font-medium border ${
            oigOk
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'bg-red-100 border-red-300 text-red-800'
          } ${runningPSV === 'oig' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
          title={windowStatus.oig?.latest_at ? `Last verified: ${new Date(windowStatus.oig.latest_at).toLocaleDateString()}` : 'Click to verify'}
        >
          OIG {oigOk ? '✅' : '⚠'} {runningPSV === 'oig' ? '...' : ''}
        </button>
      </div>

      {/* PSV Summary Widget */}
      <div className={`mt-4 p-3 border rounded ${allGreen ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs font-semibold">PSV Summary:</span>
            {Object.entries(psvSummary).map(([src, ok]) => (
              <span
                key={src}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  ok ? 'bg-green-100 border border-green-300 text-green-800' : 'bg-red-100 border border-red-300 text-red-800'
                }`}
              >
                {src.toUpperCase()} {ok ? '✅' : '⚠'}
              </span>
            ))}
          </div>
          {!allGreen && (
            <a
              href={`/compliance?npi=${params.npi}`}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              Fix
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-2 text-xs items-center mt-4">
        <label className="font-medium">State:</label>
        <input
          className="p-2 border rounded w-14"
          value={st}
          onChange={(e) => setSt(e.target.value.toUpperCase())}
        />
        <label className="font-medium">License #:</label>
        <input
          className="p-2 border rounded w-28"
          value={num}
          onChange={(e) => setNum(e.target.value)}
        />
        <button className="px-3 py-2 border rounded hover:bg-gray-100" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Lookup'}
        </button>
        <button
          className="px-3 py-2 border rounded hover:bg-gray-100"
          onClick={refetch}
          disabled={refreshing || !lic}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {lic && (
        <div className="mt-3 p-3 border rounded text-xs">
          <span
            className={
              'px-2 py-0.5 rounded border ' + (ok ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300')
            }
          >
            {st} • {num} • {ok ? '✔ active' : '⨉ check'}
          </span>
          <div className="opacity-70 mt-2">
            <div>
              <strong>Name:</strong> {lic.name || '-'}
            </div>
            <div>
              <strong>Source:</strong>{' '}
              <a className="underline" href={lic.source} target="_blank" rel="noopener noreferrer">
                {lic.source}
              </a>
            </div>
            <div>
              <strong>TTL:</strong> {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : '—'}
            </div>
            <div>
              <strong>Cached:</strong> {lic.cached ? 'Yes' : 'No (fresh)'}
            </div>
          </div>
        </div>
      )}

      {!lic && !loading && (
        <div className="mt-3 p-3 border rounded text-xs opacity-70">Enter a state and license number to begin.</div>
      )}

      {/* Latest Monitoring Checks */}
      {monitoringEvents.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold mb-2">Latest Monitoring Checks</h2>
          <div className="space-y-2">
            {monitoringEvents.slice(0, 5).map((event, i) => (
              <div key={event.eventId || i} className="p-3 border rounded text-xs bg-gray-50">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-gray-700">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] uppercase tracking-wider">
                    {event.issuerId || 'MONITORING'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 w-2 h-2 rounded-full ${
                    event.eventType.includes('error') || event.payload?.valid === false || event.payload?.match === true
                      ? 'bg-red-500'
                      : 'bg-green-500'
                  }`} />
                  <div>
                    <div className="font-medium">{event.eventType}</div>
                    {event.payload && (
                      <pre className="mt-1 text-[10px] text-gray-600 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(event.payload, null, 2).replace(/[{}"\\]/g, ' ').trim()}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


