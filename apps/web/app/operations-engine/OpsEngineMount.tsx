'use client';

import dynamic from 'next/dynamic';

// The engine reads localStorage / Date.now() at module load, so it must only
// evaluate in the browser — ssr:false keeps it off the server render path.
const OpsEngineClient = dynamic(() => import('@/components/ops-engine/OpsEngineClient'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#0b0e13', color: '#8b97a8' }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        Loading operations engine…
      </span>
    </div>
  ),
});

export default function OpsEngineMount() {
  return <OpsEngineClient />;
}
