"use client";
import { useEffect, useState } from 'react';

export default function Runs() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/dev/demo/runs', {
        headers: { 'x-dev-role': 'admin' }
      });
      const js = await r.json();
      setRows(js.rows || []);
    })();
  }, []);

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Demo Test Runs</h1>
      <p className='text-sm text-gray-600 mt-1'>History of headless test executions</p>
      <div className='mt-4 space-y-2'>
        {rows.map((x: any, i: number) => (
          <details key={i} className='p-3 border rounded text-xs'>
            <summary className='cursor-pointer font-semibold'>
              <span className={x.status === 'pass' ? 'text-green-600' : 'text-red-600'}>
                {x.status?.toUpperCase()}
              </span>
              {' • '}
              <span className='font-normal'>{x.name || 'Script'}</span>
              {' • '}
              <span className='text-gray-500'>
                {new Date(x.started_at).toLocaleString()}
              </span>
              {x.finished_at && (
                <span className='text-gray-500'>
                  {' → '}{new Date(x.finished_at).toLocaleTimeString()}
                  {' '}({x.summary?.duration_ms || 0}ms)
                </span>
              )}
            </summary>
            <div className='mt-2 mb-3'>
              <a
                href={`/api/dev/demo/junit/${x.id}`}
                target='_blank'
                className='inline-block px-3 py-1 text-xs bg-green-50 border border-green-200 rounded hover:bg-green-100'
                rel='noopener noreferrer'
              >
                📥 Download JUnit XML
              </a>
            </div>
            <div className='mt-3 space-y-2'>
              {x.summary?.steps?.map((step: any, j: number) => (
                <div
                  key={j}
                  className={`p-2 rounded text-xs ${
                    step.status === 'pass' ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className='font-mono'>
                    <b>Step {step.idx + 1}:</b> {step.step.type}
                    {step.step.selector && (
                      <span className='text-gray-600'> → {step.step.selector}</span>
                    )}
                    {step.step.text && (
                      <span className='text-blue-600'> "{step.step.text}"</span>
                    )}
                  </div>
                  <div className='text-gray-600 mt-1'>
                    Status: {step.status} • Duration: {step.duration_ms}ms
                  </div>
                  {step.error && (
                    <div className='text-red-600 mt-1 font-semibold'>
                      Error: {step.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <pre className='bg-gray-50 p-2 rounded mt-2 overflow-auto text-[10px]'>
              {JSON.stringify(x.summary, null, 2)}
            </pre>
          </details>
        ))}
      </div>
    </div>
  );
}

