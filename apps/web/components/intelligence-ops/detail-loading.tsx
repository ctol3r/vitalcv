import { OpsCard } from './primitives';

export function IntelligenceDetailLoading({
  title,
}: {
  title: string;
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#060b13,#09101b_42%,#070c14)] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <OpsCard>
          <div className="space-y-4 animate-pulse">
            <div className="h-3 w-32 rounded-full bg-white/10" />
            <div className="h-10 w-72 rounded-2xl bg-white/10" />
            <div className="h-4 w-full max-w-2xl rounded-full bg-white/5" />
            <div className="h-4 w-full max-w-xl rounded-full bg-white/5" />
          </div>
        </OpsCard>
        <OpsCard>
          <div className="space-y-3 animate-pulse">
            <div className="h-5 w-40 rounded-full bg-white/10" />
            <div className="h-28 rounded-3xl bg-white/5" />
            <div className="h-28 rounded-3xl bg-white/5" />
          </div>
        </OpsCard>
        <p className="text-sm text-slate-400">{title} is loading…</p>
      </div>
    </main>
  );
}
