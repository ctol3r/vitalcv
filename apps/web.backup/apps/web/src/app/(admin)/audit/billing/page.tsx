'use client';

import React, { useEffect, useState } from 'react';

interface AuditEvent {
  eventId: string;
  timestamp: string;
  hash: string;
  txId?: string;
  eventType: string;
  action: string;
  payload: any;
  tags?: string[];
  issuerId?: string;
}

export default function BillingAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/audit')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data);
        }
      })
      .catch((err) => console.error('Failed to fetch audit logs', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Billing Audit Visualizer</h1>
        <div className="text-sm text-slate-500">
          Revenue Anchoring & Reconciliation
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading audit trail...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Event ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type / Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Org / Units</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Proof Hash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Chain Tx</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {events.map((evt) => (
                  <tr key={evt.eventId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">
                      {evt.eventId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{evt.eventType}</div>
                      <div className="text-xs text-slate-500">{evt.action}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div>Org: {evt.issuerId || evt.payload?.orgId || 'N/A'}</div>
                      <div>Units: {evt.payload?.units ?? '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded truncate max-w-[150px]" title={evt.hash}>
                        {evt.hash}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {evt.txId ? (
                        <a
                          href={`https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944#/explorer/query/${evt.txId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-xs font-mono"
                        >
                          {evt.txId.substring(0, 10)}...
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No audit events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}














