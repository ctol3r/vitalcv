'use client';

import { useEffect, useState } from 'react';

export default function EUDIStatus() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const r = await fetch('/api/eudi/trusted-list/status');
      const d = await r.json();
      setData(d);
    } catch (e) {
      console.error('Failed to load EUDI status:', e);
    }
  }

  async function sync() {
    setLoading(true);
    try {
      const r = await fetch('/api/eudi/trusted-list/sync', { method: 'POST' });
      const d = await r.json();
      setData(d);
    } catch (e) {
      console.error('Failed to sync:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stale = data?.fetched_at ? (Date.now() - Date.parse(data.fetched_at)) / 86400000 > 7 : true;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">EUDI Trusted List Status</h1>
      <p className="text-sm text-gray-600 mb-6">
        ETSI TS119612 v2.4.1 conformance for eIDAS2/EUDI wallet issuance
      </p>

      {stale && (
        <div className="mb-4 text-sm p-3 rounded bg-red-100 border border-red-300 text-red-900">
          ⚠️ Trusted list stale — EUDI credential issuance blocked.{' '}
          <button
            onClick={sync}
            disabled={loading}
            className="underline font-semibold hover:no-underline"
          >
            {loading ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {data && (
        <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500">Template</div>
              <div className="font-semibold">{data.template || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Fetched At</div>
              <div className="font-semibold">
                {data.fetched_at ? new Date(data.fetched_at).toLocaleString() : 'Never'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Provider Count</div>
              <div className="font-semibold">{data.provider_count || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Qualified</div>
              <div className="font-semibold text-green-700">{data.qualified_count || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Non-Qualified</div>
              <div className="font-semibold text-amber-700">{data.nonqualified_count || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Warnings</div>
              <div className="font-semibold text-red-700">{data.warnings?.length || 0} issues</div>
            </div>
          </div>

          {data.warnings && data.warnings.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm font-semibold mb-2">Conformance Warnings</div>
              <ul className="text-xs space-y-1 text-gray-700">
                {data.warnings.slice(0, 10).map((w: string, i: number) => (
                  <li key={i} className="pl-2 border-l-2 border-amber-400">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={sync}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      )}

      {!data && (
        <div className="text-center py-12 text-gray-500">
          No trusted list data. Click Sync Now to fetch.
        </div>
      )}
    </div>
  );
}
