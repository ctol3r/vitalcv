import { OpsCard } from './primitives';

export function IntelligenceDetailLoading({
  title,
}: {
  title: string;
}) {
  return (
    <main className="ops-shell min-h-screen px-4 py-6 text-[var(--vt-text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <OpsCard>
          <div className="space-y-4 animate-pulse">
            <div className="h-3 w-32 rounded-full bg-[var(--vt-border)]" />
            <div className="h-10 w-72 rounded-2xl bg-[var(--vt-surface-subtle)]" />
            <div className="h-4 w-full max-w-2xl rounded-full bg-[var(--vt-border-subtle)]" />
            <div className="h-4 w-full max-w-xl rounded-full bg-[var(--vt-border-subtle)]" />
          </div>
        </OpsCard>
        <OpsCard>
          <div className="space-y-3 animate-pulse">
            <div className="h-5 w-40 rounded-full bg-[var(--vt-border)]" />
            <div className="h-28 rounded-3xl bg-[var(--vt-border-subtle)]" />
            <div className="h-28 rounded-3xl bg-[var(--vt-border-subtle)]" />
          </div>
        </OpsCard>
        <p className="text-sm text-[var(--vt-text-muted)]">{title} is loading…</p>
      </div>
    </main>
  );
}
