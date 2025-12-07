"use client";
import { useEffect, useState } from 'react';

export default function Metrics() {
  const [txt, setTxt] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/metrics');
      setTxt(await r.text());
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Pilot Metrics</h1>
      <pre className='text-[10px] bg-gray-50 p-3 rounded overflow-auto'>
        {txt || '...'}
      </pre>
    </div>
  );
}

