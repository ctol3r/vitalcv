"use client";

import { useEffect, useState } from 'react';

interface VerifyEvent {
  ts?: string;
  request?: {
    npi?: string;
    profession?: string;
    patient?: string;
    mode?: string;
  };
  result?: {
    authorized?: boolean;
    reasons?: string[];
  };
}

export default function WSVerify() {
  const [rows, setRows] = useState<VerifyEvent[]>([]);
  const [presence, setPresence] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        if (msg.type === 'bootstrap') {
          setRows(Array.isArray(msg.rows) ? msg.rows : []);
        }

        if (msg.type === 'verify') {
          setRows((prev) => [...prev.slice(-99), msg.row]);
        }

        if (msg.type === 'presence') {
          setPresence(msg.value || 0);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className='max-w-6xl mx-auto py-8 px-4'>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Live Verification Stream (WebSocket)</h1>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <div
              className={
                'w-3 h-3 rounded-full ' +
                (connected ? 'bg-green-500 animate-pulse' : 'bg-red-500')
              }
            ></div>
            <span className='text-sm text-gray-600'>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className='text-sm text-gray-600'>
            <span className='font-semibold'>{presence}</span> client{presence !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <p className='text-sm text-gray-600 mb-6'>
        Real-time feed of verification events via WebSocket. Includes live presence counter showing connected clients.
      </p>

      <div className='bg-white border rounded-lg shadow-sm overflow-hidden'>
        <div className='bg-gray-50 px-4 py-3 border-b'>
          <div className='flex items-center justify-between text-xs font-medium text-gray-700'>
            <div className='w-32'>Time</div>
            <div className='w-32'>Profession</div>
            <div className='w-32'>Patient State</div>
            <div className='w-24'>Result</div>
            <div className='flex-1 ml-4'>Reasons</div>
          </div>
        </div>

        <div className='divide-y max-h-[600px] overflow-y-auto'>
          {rows.length === 0 && (
            <div className='p-8 text-center text-gray-500 text-sm'>
              Waiting for verification events...
            </div>
          )}

          {rows.map((x, i) => {
            const req = x?.request || {};
            const res = x?.result || {};
            const reasons = (res.reasons || []).slice(0, 3).join(' • ');
            const time = x.ts ? new Date(x.ts).toLocaleTimeString() : '';

            return (
              <div key={i} className='px-4 py-3 flex items-center text-xs hover:bg-gray-50'>
                <div className='w-32 font-mono text-gray-600'>{time}</div>
                <div className='w-32 font-medium'>{req.profession || '?'}</div>
                <div className='w-32'>{req.patient || '?'}</div>
                <div className='w-24'>
                  <span
                    className={
                      'px-2 py-1 rounded text-xs font-medium ' +
                      (res.authorized
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800')
                    }
                  >
                    {res.authorized ? '✓ OK' : '✗ BLOCK'}
                  </span>
                </div>
                <div className='flex-1 ml-4 text-gray-600 truncate' title={reasons}>
                  {reasons || '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className='mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4'>
        <h3 className='text-sm font-semibold text-blue-900 mb-2'>About WebSocket Stream</h3>
        <p className='text-xs text-blue-800'>
          This page uses WebSocket for bi-directional real-time communication with lower latency than SSE.
          The presence counter shows how many clients are currently connected, updating automatically as
          clients join or leave. Perfect for collaborative monitoring and debugging.
        </p>
      </div>
    </div>
  );
}

