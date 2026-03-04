'use client';

import dynamic from 'next/dynamic';

const ScalingGraph = dynamic(() => import('@/components/graph/ScalingGraph'), {
  ssr: false,
  loading: () => <div className="absolute inset-4 rounded-2xl border border-white/5 bg-zinc-950 flex items-center justify-center text-zinc-500">Loading Network Engine...</div>
});

export default function GlobalGraphPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">Antigravity Global Trust Network</h1>
        <p className="text-sm text-zinc-500">Interactive Hierarchy & Edge Streaming</p>
      </header>

      <div className="flex-1 p-6 relative min-h-[600px]">
        {/* Dynamic Force Graph 2D Component */}
        <ScalingGraph className="absolute inset-4 rounded-2xl border border-white/5 bg-zinc-950" />
      </div>
    </main>
  );
}
