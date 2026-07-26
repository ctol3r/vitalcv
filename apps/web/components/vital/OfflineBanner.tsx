'use client';

import * as React from 'react';
import { WifiOff } from 'lucide-react';

/**
 * OfflineBanner — mounts when the browser goes offline (or a source-dependent
 * page is showing cached information). It keeps the current information visible
 * and states, honestly, that freshness timestamps have NOT moved — VitalCV never
 * silently re-stamps stale evidence as current.
 */
export function OfflineBanner({ forceOffline }: { forceOffline?: boolean }) {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    if (forceOffline) return;
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [forceOffline]);

  if (!forceOffline && !offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-offline-banner=""
      className="flex items-center gap-2.5 border-b border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-4 py-2 text-[13px] text-[var(--vt-text-secondary)]"
    >
      <WifiOff size={15} aria-hidden="true" className="shrink-0 text-[var(--vt-text-muted)]" />
      <span>Showing the last checked information. Freshness timestamps remain unchanged.</span>
    </div>
  );
}

export default OfflineBanner;
