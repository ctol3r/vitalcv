'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// CareerGraph reads window/matchMedia/canvas at mount, so it must only evaluate
// in the browser — ssr:false keeps it off the server render path.
const CareerGraph = dynamic(() => import('@/components/career-graph/CareerGraph'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#0e1414', color: '#8b978f' }}>
      <span style={{ fontFamily: "ui-monospace, 'Geist Mono', monospace", fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        Loading the network…
      </span>
    </div>
  ),
});

export default function EvidenceNetworkMount() {
  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%' }}>
      <CareerGraph initialTheme="dark" />
      <Link
        href="/"
        style={{
          position: 'absolute', bottom: 12, left: 16, zIndex: 6,
          fontFamily: "ui-monospace, 'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', textDecoration: 'none', color: '#c9d1cb',
          background: 'rgba(17,24,24,0.72)', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 6, padding: '6px 10px', backdropFilter: 'blur(6px)',
        }}
      >
        ← vitalcv.com
      </Link>
    </div>
  );
}
