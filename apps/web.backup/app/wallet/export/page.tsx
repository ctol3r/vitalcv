"use client";
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function Export() {
  const [payload, setPayload] = useState('{}');
  const [jws, setJws] = useState('');

  async function sign() {
    const r = await fetch(BASE + '/artifacts/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: JSON.parse(payload || '{}') })
    });
    const js = await r.json();
    setJws(js.jws);
  }

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Wallet Export (Stubs)</h1>
      <p className='text-sm opacity-80'>
        Demo: signs a payload you could embed into an Apple/Google Wallet pass;
        verification is available in /api/artifacts/verify.
      </p>
      <textarea
        className='w-full p-2 border rounded mt-4'
        rows={6}
        value={payload}
        onChange={e => setPayload(e.target.value)}
      />
      <div className='mt-2 flex gap-2'>
        <button
          className='px-3 py-2 bg-black text-white rounded'
          onClick={sign}
        >
          Sign
        </button>
        {jws && (
          <a
            className='px-3 py-2 border rounded'
            href={'data:text/plain,' + encodeURIComponent(jws)}
            download='credential.artifact.jws'
          >
            Download .jws
          </a>
        )}
      </div>
      {jws && (
        <pre className='mt-3 text-[10px] bg-gray-50 p-2 rounded overflow-auto'>
          {jws}
        </pre>
      )}
    </div>
  );
}

