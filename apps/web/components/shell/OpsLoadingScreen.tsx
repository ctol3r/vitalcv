/**
 * OpsLoadingScreen — canonical loading skeleton for all ops/intelligence routes.
 *
 * Replaces the copy-paste spinner loading.tsx files
 * across the /(intelligence)/ route group.
 *
 * Usage in loading.tsx:
 *   export { OpsLoadingScreen as default } from '@/components/shell/OpsLoadingScreen';
 */

export function OpsLoadingScreen({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-vt-surface-ops-base px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
          <div className="h-3 w-28 rounded-full bg-[var(--vt-border)]" />
          <div className="mt-3 h-6 w-64 max-w-full rounded-full bg-[var(--vt-surface-2)]" />
          <div className="mt-2 h-4 w-96 max-w-full rounded-full bg-[var(--vt-surface-2)]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,360px)]">
          <div className="space-y-4 rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-4">
            <div className="h-20 rounded-md bg-[var(--vt-surface)]" />
            <div className="h-28 rounded-md bg-[var(--vt-surface)]" />
            <div className="h-28 rounded-md bg-[var(--vt-surface)]" />
          </div>

          <div className="space-y-4 rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
            <div className="h-12 rounded-md bg-[var(--vt-surface-dim)]" />
            <div className="h-40 rounded-md bg-[var(--vt-surface-dim)]" />
            <div className="h-56 rounded-md bg-[var(--vt-surface-dim)]" />
          </div>

          <div className="space-y-4 rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-4">
            <div className="h-48 rounded-md bg-[var(--vt-surface)]" />
            <div className="h-28 rounded-md bg-[var(--vt-surface)]" />
            <div className="h-32 rounded-md bg-[var(--vt-surface)]" />
          </div>
        </div>

        <div className="px-1 text-sm text-vt-neutral-500">
          {label}
        </div>
      </div>
    </div>
  );
}

export default OpsLoadingScreen;
