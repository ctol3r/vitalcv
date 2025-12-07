"use client";
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

type CryptoMode = 'sdjwt' | 'bbs';

export default function SDCard() {
  const [mode, setMode] = useState<CryptoMode>('sdjwt');
  const [claims, setClaims] = useState('{"name":"Dr. Alice","npi":"1234","license":"CA12345"}');
  const [sd, setSd] = useState<any>();
  const [pres, setPres] = useState<any>();
  const [verified, setVerified] = useState<any>();

  const handleIssue = async () => {
    const endpoint = mode === 'sdjwt' ? '/crypto/sdjwt/issue' : '/crypto/bbs/issue';
    const r = await fetch(BASE + endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claims: JSON.parse(claims || '{}') })
    });
    setSd(await r.json());
    setPres(null);
    setVerified(null);
  };

  const handlePresent = async () => {
    const endpoint = mode === 'sdjwt' ? '/crypto/sdjwt/present' : '/crypto/bbs/present';
    const payload = mode === 'sdjwt'
      ? { sd_jwt: sd?.sd_jwt, disclose: ['name', 'license'] }
      : { credential: sd?.credential, reveal: ['name', 'license'] };

    const r = await fetch(BASE + endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setPres(await r.json());
    setVerified(null);
  };

  const handleVerify = async () => {
    const endpoint = mode === 'sdjwt' ? '/crypto/sdjwt/verify' : '/crypto/bbs/verify';
    const r = await fetch(BASE + endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presentation: pres?.presentation })
    });
    setVerified(await r.json());
  };

  return (
    <div className='p-5 border-2 rounded-lg bg-white shadow-sm'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-3'>
          <h3 className='text-lg font-semibold'>Selective Disclosure Demo</h3>
          {/* Proof Badge */}
          {verified && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              verified.ok || verified.valid
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {verified.ok || verified.valid ? '✓ Verified' : '✗ Invalid'}
            </span>
          )}
        </div>

        {/* Mode Toggle */}
        <div className='flex gap-1 p-1 bg-gray-100 rounded-lg'>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'sdjwt'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => { setMode('sdjwt'); setSd(null); setPres(null); setVerified(null); }}
          >
            SD-JWT
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'bbs'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => { setMode('bbs'); setSd(null); setPres(null); setVerified(null); }}
          >
            BBS+
          </button>
        </div>
      </div>

      <div className='mb-3'>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          Claims JSON {mode === 'bbs' && <span className='text-xs text-blue-600'>(BBS+ signatures)</span>}
        </label>
        <textarea
          className='w-full p-3 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          rows={4}
          value={claims}
          onChange={e => setClaims(e.target.value)}
          placeholder='{"name": "Dr. Alice", "npi": "1234"}'
        />
      </div>

      <div className='flex gap-2 flex-wrap'>
        <button
          className='px-4 py-2 rounded-lg bg-black text-white font-medium hover:bg-gray-800 transition-colors'
          onClick={handleIssue}
        >
          1. Issue {mode === 'sdjwt' ? 'SD-JWT' : 'BBS+ Credential'}
        </button>
        <button
          className='px-4 py-2 rounded-lg border-2 border-gray-300 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          onClick={handlePresent}
          disabled={!sd}
        >
          2. Present (name + license)
        </button>
        <button
          className='px-4 py-2 rounded-lg border-2 border-green-500 text-green-700 font-medium hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          onClick={handleVerify}
          disabled={!pres}
        >
          3. Verify
        </button>
      </div>

      {/* Results */}
      <div className='mt-4 space-y-3'>
        {sd && (
          <details className='bg-blue-50 border border-blue-200 rounded-lg'>
            <summary className='px-3 py-2 cursor-pointer font-medium text-sm text-blue-800 hover:bg-blue-100'>
              📝 Issued {mode === 'sdjwt' ? 'SD-JWT' : 'BBS+ Credential'}
            </summary>
            <pre className='px-3 pb-3 text-[10px] overflow-auto max-h-64 font-mono'>
              {JSON.stringify(sd, null, 2)}
            </pre>
          </details>
        )}

        {pres && (
          <details className='bg-purple-50 border border-purple-200 rounded-lg'>
            <summary className='px-3 py-2 cursor-pointer font-medium text-sm text-purple-800 hover:bg-purple-100'>
              🎭 Selective fields: {mode === 'sdjwt' ? 'name, license' : 'name, license'}
            </summary>
            <pre className='px-3 pb-3 text-[10px] overflow-auto max-h-64 font-mono'>
              {JSON.stringify(pres, null, 2)}
            </pre>
          </details>
        )}

        {verified && (
          <div className={`p-3 border-2 rounded-lg ${
            verified.valid
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}>
            <div className='flex items-center gap-2 mb-2'>
              <span className='text-xl'>{verified.valid ? '✅' : '❌'}</span>
              <span className='font-semibold text-sm'>
                {verified.valid ? 'Verification Successful' : 'Verification Failed'}
              </span>
            </div>
            <details>
              <summary className='cursor-pointer text-xs text-gray-700 hover:text-gray-900'>
                View Details
              </summary>
              <pre className='mt-2 text-[10px] overflow-auto max-h-48 font-mono bg-white p-2 rounded border'>
                {JSON.stringify(verified, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

