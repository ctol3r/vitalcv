"use client";
import { useEffect, useState } from 'react';

export default function WhatsNew() {
  const [md, setMd] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/changelog');
      setMd(await r.text());
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8 px-6'>
      <h1 className='text-3xl font-bold mb-6'>What's New</h1>
      <pre className='text-sm bg-gray-50 p-4 rounded whitespace-pre-wrap leading-relaxed'>
        {md || 'Loading…'}
      </pre>
    </div>
  );
}

