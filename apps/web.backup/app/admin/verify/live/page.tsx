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

export default function LiveVerify() {
  const [rows, setRows] = useState<VerifyEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/verify/stream');

    es.onopen = () => {
      setConnected(true);
    };

    es.onerror = () => {
      setConnected(false);
    };

    es.addEventListener('bootstrap', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to parse bootstrap:', err);
      }
    });

    es.addEventListener('verify', (e: any) => {
      try {
        const r = JSON.parse(e.data);
        setRows((prev) => [...prev.slice(-99), r]);
      } catch (err) {
        console.error('Failed to parse verify event:', err);
      }
    });

    return () => es.close();
  }, []);

  return (
    <div className='max-w-6xl mx-auto py-8 px-4'>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Live Verification Stream</h1>
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
      </div>

      <p className='text-sm text-gray-600 mb-6'>
        Real-time feed of verification events via Server-Sent Events. No polling, no refresh needed.
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
        <h3 className='text-sm font-semibold text-blue-900 mb-2'>About Live Stream</h3>
        <p className='text-xs text-blue-800'>
          This page uses Server-Sent Events (SSE) to stream verification results in real-time.
          Bootstraps with the last 20 events on connect, then receives new events as they occur.
          Perfect for monitoring verification logic during development and QA.
        </p>
      </div>
    </div>
  );
}

