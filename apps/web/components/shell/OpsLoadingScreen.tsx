/**
 * OpsLoadingScreen — canonical loading state for all ops/intelligence routes.
 *
 * Replaces the 8 copy-paste `bg-[#080e1a]` + spinner loading.tsx files
 * across the /(intelligence)/ route group.
 *
 * Usage in loading.tsx:
 *   export { OpsLoadingScreen as default } from '@/components/shell/OpsLoadingScreen';
 */

export function OpsLoadingScreen({ label = 'Loading\u2026' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-vt-surface-ops-base">
      <div className="flex items-center gap-3 text-vt-neutral-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-vt-neutral-700 border-t-vt-neutral-400" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export default OpsLoadingScreen;
