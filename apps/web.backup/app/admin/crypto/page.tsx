"use client";
import { useEffect, useState } from 'react';

export default function CryptoAdmin() {
  const [jwks, setJwks] = useState<any>();
  const [kid, setKid] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/.well-known/jwks.json');
      setJwks(await r.json());
    })();
  }, []);

  async function rotate() {
    const r = await fetch('/api/admin/issuer/rotate-keys', { method: 'POST' });
    const js = await r.json();
    setKid(js.kid);

    const j = await (await fetch('/.well-known/jwks.json')).json();
    setJwks(j);
  }

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Crypto Admin</h1>
      <button
        className='px-3 py-2 rounded bg-black text-white mt-4'
        onClick={rotate}
      >
        Rotate Keys
      </button>
      {kid && (
        <div className='mt-2 text-xs'>
          New KID: <code>{kid}</code>
        </div>
      )}
      <pre className='mt-3 text-[10px] bg-gray-50 p-2 rounded overflow-auto max-h-96'>
        {JSON.stringify(jwks, null, 2)}
      </pre>
    </div>
  );
}

