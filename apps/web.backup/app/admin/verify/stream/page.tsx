'use client';
import { useEffect, useState } from 'react';

interface VerifyResult {
  ts: string;
  request: {
    profession?: string;
    patient?: string;
    npi?: string;
  };
  result: {
    authorized?: boolean;
    reasons?: string[];
  };
}

export default function VerifyStream() {
  const [rows, setRows] = useState<VerifyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/verify/recent?n=100');
      if (!r.ok) throw new Error('Failed to fetch verify results');
      const js = await r.json();
      setRows(js.rows || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Recent Verifies</h1>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs text-gray-500">Live • Updates every 5s</span>
        </div>
      </div>

      {loading && rows.length === 0 && (
        <div className="text-center py-12 text-gray-500">Loading verification stream...</div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          Error: {error}
        </div>
      )}

      <div className="space-y-2">
        {rows.map((x: VerifyResult, i: number) => {
          const req = x.request || {};
          const res = x.result || {};
          const reasons = (res.reasons || []).slice(0, 3).join(' • ');
          const authorized = res.authorized || false;

          return (
            <div
              key={i}
              className="p-3 border rounded-lg text-sm flex items-center justify-between hover:shadow-md transition-shadow bg-white"
            >
              <div className="flex-1">
                <div className="font-semibold">
                  {req.profession || '?'}
                  <span className="text-gray-400 mx-2">@</span>
                  {req.patient || '?'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {req.npi && <span className="mr-3">NPI: {req.npi}</span>}
                  {new Date(x.ts).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {reasons && (
                  <div className="text-xs text-gray-600 max-w-xs truncate opacity-70">
                    {reasons}
                  </div>
                )}
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    authorized
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {authorized ? 'AUTHORIZED' : 'BLOCKED'}
                </div>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-400 border rounded-lg">
            No verification results yet
          </div>
        )}
      </div>
    </div>
  );
}
