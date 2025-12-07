'use client';
import { useEffect, useState } from 'react';

export default function Gov() {
  const [d, setD] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/ai/governance');
        const js = await r.json();
        setD(js.rows || js || []);
      } catch (error) {
        console.error('Failed to load governance data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function downloadCSV() {
    const csv = [
      ['model', 'version', 'accuracy', 'bias', 'owner', 'timestamp'].join(','),
      ...d.map((r: any) =>
        [
          r.model_id || r.model || '',
          r.model_version || r.version || '',
          r.accuracy || r.acc || 0,
          r.bias_score || r.bias || 0,
          r.owner || '',
          r.ts || r.timestamp || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-governance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">AI Governance Monitor</h1>
        <button
          onClick={downloadCSV}
          className="px-3 py-2 bg-black text-white rounded text-sm"
        >
          Download CSV
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : d.length === 0 ? (
        <div className="text-sm text-gray-500">No governance events found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs mt-3 border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Model</th>
                <th className="text-left p-2">Version</th>
                <th className="text-right p-2">Accuracy %</th>
                <th className="text-right p-2">Bias %</th>
                <th className="text-left p-2">Owner</th>
                <th className="text-left p-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {d.map((r: any, i: number) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="p-2">{r.model_id || r.model || '-'}</td>
                  <td className="p-2">{r.model_version || r.version || '-'}</td>
                  <td className="p-2 text-right">
                    {((r.accuracy || r.acc || 0) * 100).toFixed(1)}%
                  </td>
                  <td className="p-2 text-right">
                    {((r.bias_score || r.bias || 0) * 100).toFixed(1)}%
                  </td>
                  <td className="p-2">{r.owner || '-'}</td>
                  <td className="p-2">
                    {r.ts || r.timestamp
                      ? new Date(r.ts || r.timestamp).toLocaleString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

