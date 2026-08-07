'use client';

import dynamic from 'next/dynamic';
import type { OpsSnapshot } from '@/lib/ops-engine/contract';

// The engine touches window/localStorage at module load — client-only.
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

export default function OpsEngineLiveMount({ snapshot }: { snapshot: OpsSnapshot }) {
  return <OpsEngineClient liveSnapshot={snapshot} />;
}
