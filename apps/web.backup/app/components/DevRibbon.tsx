"use client";
import { useEffect, useState } from 'react';
import DevBadges from './DevBadges';

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
const base = API_BASE || '';

export default function DevRibbon() {
  const [d, setD] = useState<any>();
  const [hidden, setHidden] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dev_ribbon_hide') === '1';
    }
    return false;
  });
  const [demoMode, setDemoMode] = useState(false);
  const [dpopRotationNotice, setDpopRotationNotice] = useState<{
    previousThumbprint: string | null;
    newThumbprint: string;
    rotationTime: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${base}/dev/status`);
        setD(await r.json());
      } catch {}
    })();

    // Check demo mode status
    if (typeof window !== 'undefined') {
      const checkDemoMode = () => {
        const isDemoChip = localStorage.getItem('dev_demo_chip') === '1';
        setDemoMode(isDemoChip);
      };

      checkDemoMode();

      // Listen for storage events
      window.addEventListener('storage', checkDemoMode);
      return () => window.removeEventListener('storage', checkDemoMode);
    }
  }, []);

  // Listen for DPoP key rotation events (B105A-FE-003)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleDpopRotation = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setDpopRotationNotice(customEvent.detail);
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setDpopRotationNotice(null);
        }, 10000);
      }
    };

    window.addEventListener('dpop-key-rotated', handleDpopRotation);
    return () => {
      window.removeEventListener('dpop-key-rotated', handleDpopRotation);
    };
  }, []);

  const handleHide = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dev_ribbon_hide', '1');
      setHidden(true);
    }
  };

  // Don't render if hidden
  if (hidden) return null;

  const sha = (d?.version?.sha || '').slice(0, 7);
  const api = d?.ok ? 'API:ok' : 'API:down';

  return (
    <div className='sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur px-3 py-1 text-[11px] flex items-center gap-3'>
      <span className='font-mono'>
        {d?.version?.branch || 'branch:?'}@{sha || 'sha:?'}
      </span>
      <span className={'px-2 py-0.5 rounded ' + (d?.ok ? 'bg-green-100' : 'bg-red-100')}>
        {api}
      </span>
      {demoMode && (
        <span className='px-2 py-0.5 rounded bg-yellow-200 border border-yellow-400 font-bold text-yellow-900'>
          🟡 DEMO
        </span>
      )}
      {dpopRotationNotice && (
        <span
          className='px-2 py-0.5 rounded bg-blue-100 border border-blue-300 text-blue-900 text-[10px] font-mono'
          title={`DPoP key rotated at ${new Date(dpopRotationNotice.rotationTime).toLocaleTimeString()}`}
        >
          🔑 DPoP rotated
        </span>
      )}
      <DevBadges />
      <button
        onClick={handleHide}
        className='ml-auto px-2 py-0.5 hover:bg-gray-100 rounded transition-colors'
        title='Hide dev ribbon'
      >
        ×
      </button>
    </div>
  );
}

