"use client";

import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';

export default function Preflight() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function runPreflight() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/preflight`);
      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message, checks: {} });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runPreflight();
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'PASS') return 'text-green-600 bg-green-50';
    if (status.startsWith('FAIL')) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Preflight Checks</h1>
        <button
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          onClick={runPreflight}
          disabled={loading}
        >
          {loading ? 'Running...' : 'Re-run'}
        </button>
      </div>

      {loading && !result && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Running preflight checks...</p>
        </div>
      )}

      {result && (
        <>
          {result.all_pass !== undefined && (
            <div className={`mb-6 p-4 rounded-lg ${result.all_pass ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-semibold ${result.all_pass ? 'text-green-800' : 'text-red-800'}`}>
                {result.all_pass ? '✅ All checks passed' : '❌ Some checks failed'}
              </p>
              <p className="text-sm mt-1 text-gray-600">
                Checked at: {new Date(result.timestamp).toLocaleString()}
              </p>
            </div>
          )}

          {result.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">Error running preflight</p>
              <p className="text-sm text-red-600 mt-1">{result.error}</p>
            </div>
          )}

          {result.checks && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold mb-4">Check Results</h2>
              {Object.entries(result.checks).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-lg font-mono text-sm ${getStatusColor(value as string)}`}>
                    {value as string}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <details className="border rounded-lg p-4">
              <summary className="cursor-pointer font-semibold">View Raw JSON</summary>
              <pre className="mt-4 text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        </>
      )}
    </div>
  );
}

