"use client";
import { useState } from 'react';

interface AgentApprovalBannerProps {
  traceId: string;
  mcp: string;
}

export default function AgentApprovalBanner({ traceId, mcp }: AgentApprovalBannerProps) {
  const [state, setState] = useState<'pending' | 'approved' | 'denied'>('pending');
  const [loading, setLoading] = useState(false);

  async function approve() {
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || '';
      await fetch(`${baseUrl}/api/agent/admin/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ traceId, mcp, decider: 'admin' })
      });
      setState('approved');
    } catch (err) {
      console.error('Error approving:', err);
    } finally {
      setLoading(false);
    }
  }

  if (state === 'approved') {
    return (
      <div className='p-3 border rounded bg-green-50 text-sm border-green-200'>
        <div className='font-semibold text-green-800'>✓ Approval Granted</div>
        <div className='mt-1 text-green-700'>Click "Re-run" to execute the approved action.</div>
        <div className='mt-2'>
          <button
            className='px-3 py-1.5 rounded border border-green-600 bg-green-600 text-white hover:bg-green-700 transition-colors'
            onClick={() => window.location.reload()}
          >
            Re-run
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='p-3 border rounded bg-yellow-50 text-sm border-yellow-200'>
      <div className='font-semibold text-yellow-800'>⚠ Approval Required</div>
      <div className='mt-1 text-yellow-700'>
        This action needs approval for <code className='px-1 py-0.5 rounded bg-yellow-100'>{mcp}</code>
      </div>
      <div className='text-xs mt-1 text-yellow-600'>
        Trace: <code className='px-1 py-0.5 rounded bg-yellow-100'>{traceId}</code>
      </div>
      <div className='mt-2 flex gap-2'>
        <button
          className='px-3 py-1.5 rounded bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50'
          onClick={approve}
          disabled={loading}
        >
          {loading ? 'Approving...' : 'Approve (admin)'}
        </button>
        <button
          className='px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 transition-colors'
          onClick={() => window.location.reload()}
        >
          I have approval → Re-run
        </button>
      </div>
    </div>
  );
}

