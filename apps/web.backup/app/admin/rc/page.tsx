"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function RCPage() {
  const [gate, setGate] = useState<any>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const baseUrl = BASE.replace('/api/agent', '');
        const r = await fetch(baseUrl + '/api/rc/gate');
        setGate(await r.json());
      } catch (error) {
        console.error('RC Gate check failed:', error);
        setGate({ error: String(error) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Release Candidate Gate</h1>

      {loading ? (
        <div className="text-gray-500">Checking RC gate status...</div>
      ) : gate ? (
        <>
          <div className={
            'text-lg font-semibold mb-4 px-4 py-3 rounded ' +
            (gate.GREEN ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
          }>
            {gate.GREEN ? '✓ All Checks Passed - GREEN' : '⚠ Some Checks Failed - BLOCKED'}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Health Checks:</h2>
            {gate.checks && Object.entries(gate.checks).map(([key, value]: [string, any]) => (
              <div
                key={key}
                className={
                  'p-3 rounded border ' +
                  (String(value).startsWith('PASS') ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
                }
              >
                <div className="font-mono text-sm">
                  <span className="font-semibold">{key}:</span> {value}
                </div>
              </div>
            ))}
          </div>

          <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-4 rounded mt-6 overflow-auto">
            {JSON.stringify(gate, null, 2)}
          </pre>
        </>
      ) : (
        <div className="text-red-500">Failed to load RC gate status</div>
      )}
    </div>
  );
}

