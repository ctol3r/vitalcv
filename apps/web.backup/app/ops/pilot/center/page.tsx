'use client';

import { useEffect, useState } from 'react';

export default function Center() {
  const [h, setH] = useState<any>();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [escalating, setEscalating] = useState<Record<number, boolean>>({});
  const [issueUrls, setIssueUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/pilot-health`);

    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === 'health') setH(m.payload);
      } catch {}
    };

    const es = new EventSource('/api/alerts/stream');
    es.addEventListener('alert', (e: any) => {
      try {
        const j = JSON.parse(e.data);
        setAlerts((a) => [j, ...a].slice(0, 100));
      } catch {}
    });

    return () => {
      ws.close();
      es.close();
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8">
      <h1 className="text-xl font-bold mb-4">Pilot Command Center</h1>
      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <div className="p-3 border rounded text-xs">
          <div className="font-semibold mb-1">Pilot Health (live)</div>
          <pre className="bg-gray-50 dark:bg-neutral-900 p-2 rounded overflow-auto max-h-[400px]">
            {JSON.stringify(h, null, 2)}
          </pre>
        </div>
        <div className="p-3 border rounded text-xs">
          <div className="font-semibold mb-1">Alerts (live)</div>
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {alerts.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400">No alerts</div>
            ) : (
              alerts.map((a, i) => (
                <div key={i} className="border rounded px-2 py-1 bg-white dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-2">
                    <pre className="text-xs flex-1 overflow-auto">{JSON.stringify(a, null, 2)}</pre>
                    <button
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                      disabled={escalating[i]}
                      onClick={async () => {
                        setEscalating((prev) => ({ ...prev, [i]: true }));
                        try {
                          const r = await fetch('/api/ops/escalate', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({
                              title: `PSV alert ${a.tenant || 'unknown'}`,
                              body: JSON.stringify(a, null, 2),
                              labels: ['psv', 'alert'],
                              repo: 'yourorg/yourrepo',
                            }),
                          });
                          const res = await r.json();
                          if (res.html_url) {
                            setIssueUrls((prev) => ({ ...prev, [i]: res.html_url }));
                          } else if (res.curl) {
                            alert('Set GH_TOKEN. cURL: ' + res.curl);
                          }
                        } catch (e) {
                          console.error('Escalation failed:', e);
                        } finally {
                          setEscalating((prev) => ({ ...prev, [i]: false }));
                        }
                      }}
                    >
                      {escalating[i] ? 'Escalating...' : 'Escalate'}
                    </button>
                  </div>
                  {issueUrls[i] && (
                    <div className="mt-1 text-xs">
                      <a href={issueUrls[i]} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        Issue created →
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <div className="font-semibold mb-2 text-sm">TEFCA Directory Timeline</div>
          <iframe
            src="/api/tefca/sync"
            className="w-full h-[300px] border rounded"
            title="TEFCA Directory Sync"
          />
        </div>
        <div className="border rounded p-3">
          <div className="font-semibold mb-2 text-sm">Compliance Leaderboard</div>
          <iframe
            src="/compliance/leaderboard"
            className="w-full h-[300px] border rounded"
            title="Compliance Leaderboard"
          />
        </div>
      </div>
      <div className="mt-4">
        <a
          href="/ops/tefca/delta"
          className="px-3 py-2 border rounded text-xs hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          TEFCA Delta →
        </a>
      </div>
    </div>
  );
}

