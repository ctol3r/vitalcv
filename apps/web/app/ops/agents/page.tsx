'use client';

import { listAgentRuns, triggerAgent } from '@/lib/apiClient';
import { useEffect, useState } from 'react';

export default function AgentsOps() {
  const [rows, setRows] = useState<any[]>([]);
  const [npi, setNpi] = useState('');

  const refresh = async () => {
    try {
      setRows(await listAgentRuns(npi || undefined));
    } catch (e) {
      console.error('Failed to fetch runs:', e);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleTrigger = async () => {
    if (npi.length === 10) {
      try {
        await triggerAgent(npi, 'NPLOOKUP_VIEW');
        await refresh();
      } catch (e) {
        console.error('Failed to trigger:', e);
      }
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Agents Monitor</h1>
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2"
          value={npi}
          onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="NPI (optional filter)"
        />
        <button onClick={refresh} className="bg-gray-100 hover:bg-gray-200 rounded px-3">
          Refresh
        </button>
        <button
          onClick={handleTrigger}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3"
        >
          Trigger for NPI
        </button>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Agent</th>
              <th className="p-2 border">NPI</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Started</th>
              <th className="p-2 border">Finished</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2 border">{r.id}</td>
                <td className="p-2 border">{r.agentName}</td>
                <td className="p-2 border">{r.npi || ''}</td>
                <td className="p-2 border">{r.status}</td>
                <td className="p-2 border">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="p-2 border">
                  {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
