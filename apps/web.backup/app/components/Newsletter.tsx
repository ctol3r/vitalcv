"use client";
import { useState } from 'react';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  async function sub() {
    const r = await fetch('/newsletter/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: 'footer' })
    });
    setMsg(r.ok ? 'Thanks—check your inbox soon.' : 'Please enter a valid email.');
  }

  return (
    <div className='mt-6 text-sm'>
      <div className='font-semibold'>Newsletter</div>
      <div className='flex gap-2 mt-1'>
        <input
          className='p-2 border rounded flex-1'
          placeholder='you@clinic.com'
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button
          className='px-3 py-2 rounded bg-black text-white hover:bg-gray-800 transition-colors'
          onClick={sub}
        >
          Subscribe
        </button>
      </div>
      {msg && <div className='text-xs opacity-70 mt-1'>{msg}</div>}
    </div>
  );
}

