"use client";
import { useEffect, useState } from 'react';

export default function Scripts() {
  const [rows, setRows] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [runResult, setRunResult] = useState<any>(null);

  async function load() {
    const r = await fetch('/api/dev/demo/scripts');
    const js = await r.json();
    setRows(js.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function run(id: string) {
    const r = await fetch('/api/dev/demo/scripts/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const js = await r.json();
    setSteps(js.steps || []);
    // execute client-side
    for (const s of js.steps || []) {
      if (s.type === 'navigate') {
        location.assign(s.value);
        await new Promise((r) => setTimeout(r, 600));
      }
      if (s.type === 'wait') {
        await new Promise((r) => setTimeout(r, Number(s.ms || 0)));
      }
      if (s.type === 'toast') {
        alert(s.value);
      }
    }
  }

  async function del(id: string) {
    await fetch('/api/dev/demo/scripts/' + id, { method: 'DELETE' });
    load();
  }

  async function runHeadless(id: string) {
    setRunResult({ loading: true });
    const r = await fetch('/api/dev/demo/run-headless', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dev-role': 'admin' },
      body: JSON.stringify({ script_id: id }),
    });
    const js = await r.json();
    setRunResult(js);
  }

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Demo Scripts</h1>
      <div className='mt-3 space-y-2'>
        {rows.map((s: any) => (
          <div
            key={s.id}
            className='p-2 border rounded text-xs flex items-center justify-between'
          >
            <div>
              <b>{s.name}</b> • {s.author || 'dev'} —{' '}
              {new Date(s.created_at).toLocaleString()}
            </div>
            <div className='flex gap-2'>
              <button className='px-2 py-1 border rounded' onClick={() => run(s.id)}>
                Run
              </button>
              <button className='px-2 py-1 bg-purple-50 border rounded' onClick={() => runHeadless(s.id)}>
                Run Headless
              </button>
              <button className='px-2 py-1 border rounded' onClick={() => del(s.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {steps?.length ? (
        <pre className='text-[11px] bg-gray-50 p-3 rounded mt-3'>
          {JSON.stringify(steps, null, 2)}
        </pre>
      ) : null}
      {runResult && !runResult.loading && (
        <div className='mt-4 p-4 border rounded'>
          <h2 className='font-bold text-sm mb-2'>
            Headless Run Result: <span className={runResult.status === 'pass' ? 'text-green-600' : 'text-red-600'}>{runResult.status?.toUpperCase()}</span>
          </h2>
          {runResult.summary?.steps?.map((step: any, i: number) => (
            <div key={i} className={`text-xs p-2 rounded mb-1 ${step.status === 'pass' ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className='font-mono'>
                <b>Step {step.idx + 1}:</b> {step.step.type}
                {step.step.selector && <span className='text-gray-600'> → {step.step.selector}</span>}
              </div>
              <div className='text-gray-600'>Status: {step.status} • Duration: {step.duration_ms}ms</div>
              {step.error && <div className='text-red-600 mt-1'>Error: {step.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


