"use client";
import { useEffect, useState } from 'react';

export default function DevEnv() {
  const [d, setD] = useState<any>();

  useEffect(() => {
    (async () => {
      const r = await fetch('/dev/env');
      setD(await r.json());
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Environment (redacted)</h1>
      {d ? (
        <pre className='text-xs bg-gray-50 p-3 rounded mt-4'>{JSON.stringify(d.env, null, 2)}</pre>
      ) : (
        'Loading…'
      )}
    </div>
  );
}

