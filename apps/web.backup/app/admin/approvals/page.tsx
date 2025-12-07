"use client";
import { useEffect, useState } from 'react';

interface Approval {
  id: string;
  trace_id: string;
  mcp_name: string;
  gate: string;
  status: string;
  requested_by?: string;
  decided_by?: string;
  decided_at?: string;
  notes?: string;
  created_at: string;
}

export default function Approvals() {
  const [rows, setRows] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';
      const r = await fetch(`${baseUrl}/api/agent/admin/approvals`);
      if (!r.ok) throw new Error('Failed to fetch approvals');
      const js = await r.json();
      setRows(js.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval: Approval) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/agent/admin/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          traceId: approval.trace_id,
          mcp: approval.mcp_name,
          decider: 'admin',
          notes: 'Approved via UI'
        })
      });
      loadApprovals();
    } catch (err) {
      console.error('Error approving:', err);
    }
  };

  const handleDeny = async (approval: Approval) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/agent/admin/deny`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          traceId: approval.trace_id,
          mcp: approval.mcp_name,
          decider: 'admin',
          notes: 'Denied via UI'
        })
      });
      loadApprovals();
    } catch (err) {
      console.error('Error denying:', err);
    }
  };

  if (loading) {
    return (
      <div className='max-w-6xl mx-auto py-8'>
        <div className='text-center text-gray-500'>Loading approvals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='max-w-6xl mx-auto py-8'>
        <div className='text-center text-red-500'>Error: {error}</div>
      </div>
    );
  }

  const pendingApprovals = rows.filter(a => a.status === 'pending');
  const decidedApprovals = rows.filter(a => a.status !== 'pending');

  return (
    <div className='max-w-6xl mx-auto py-8 px-4'>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-2xl font-bold'>Agent Approvals</h2>
        <button
          onClick={loadApprovals}
          className='px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50'
        >
          Refresh
        </button>
      </div>

      {/* Pending Approvals */}
      <div className='mb-8'>
        <h3 className='text-lg font-semibold mb-3 text-yellow-800'>
          Pending ({pendingApprovals.length})
        </h3>
        {pendingApprovals.length === 0 ? (
          <div className='p-4 border border-gray-200 rounded bg-gray-50 text-gray-500 text-sm'>
            No pending approvals
          </div>
        ) : (
          <div className='space-y-3'>
            {pendingApprovals.map((a) => (
              <div key={a.id} className='p-4 border border-yellow-200 rounded bg-yellow-50'>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <div className='text-sm font-medium'>
                      MCP: <code className='px-2 py-1 rounded bg-yellow-100'>{a.mcp_name}</code>
                      <span className='ml-3 text-gray-600'>Gate: {a.gate}</span>
                    </div>
                    <div className='text-xs text-gray-600 mt-1'>
                      Trace: <code className='px-1 py-0.5 rounded bg-yellow-100'>{a.trace_id}</code>
                    </div>
                    <div className='text-xs text-gray-600 mt-1'>
                      Requested by: {a.requested_by || 'system'} •
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className='flex gap-2 ml-4'>
                    <button
                      onClick={() => handleApprove(a)}
                      className='px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700'
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(a)}
                      className='px-3 py-1.5 text-sm rounded border border-red-600 text-red-600 hover:bg-red-50'
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decided Approvals */}
      <div>
        <h3 className='text-lg font-semibold mb-3 text-gray-700'>
          History ({decidedApprovals.length})
        </h3>
        <div className='space-y-3'>
          {decidedApprovals.slice(0, 20).map((a) => (
            <div key={a.id} className={`p-3 border rounded ${
              a.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className='text-sm'>
                <span className='font-medium'>
                  {a.status === 'approved' ? '✓' : '✗'} {a.mcp_name}
                </span>
                <span className='ml-3 text-xs text-gray-600'>
                  Trace: {a.trace_id.slice(0, 8)}...
                </span>
              </div>
              <div className='text-xs text-gray-600 mt-1'>
                Decided by: {a.decided_by || '-'} •
                {a.decided_at ? new Date(a.decided_at).toLocaleString() : '-'}
                {a.notes && ` • ${a.notes}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

