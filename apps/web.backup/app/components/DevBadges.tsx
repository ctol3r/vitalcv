"use client";
import { useEffect, useState } from 'react';

export default function DevBadges() {
  const [d, setD] = useState<any>();

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/dev/ci');
        setD(await r.json());
      } catch {
        // Silently fail if backend is down
      }
    })();
  }, []);

  if (!d?.ok) return null;

  return (
    <div className='flex items-center gap-3 text-[11px]'>
      <img src={d.badges?.backend} alt='backend ci' className='h-4' />
      <img src={d.badges?.frontend} alt='frontend ci' className='h-4' />
      {d.vercel && (
        <a className='underline' href={d.vercel} target='_blank' rel='noreferrer'>
          Vercel
        </a>
      )}
    </div>
  );
}

