'use client';

import dynamic from 'next/dynamic';

// The surface routes off window.location.hash from first render, so it only
// evaluates in the browser — ssr:false keeps it off the server render path
// (same mount pattern as the wave1400 /operations-engine port).
const Wave1505Client = dynamic(() => import('@/components/design-wave1505/Wave1505Client'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#f4f2ec', color: '#6b6860' }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        Loading wave 1505…
      </span>
    </div>
  ),
});

export default function Wave1505Mount() {
  return <Wave1505Client />;
}
