'use client';

import { AlertTriangle, WifiOff } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';

export default function NetworkStatusBanner() {
  const { data, isOffline, refreshError } = useClinicianMobile();

  if (!isOffline && !refreshError) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 border-b border-amber-400/20 bg-amber-500/10 px-4 py-3 text-amber-50 backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-5xl items-start gap-3">
        {isOffline ? (
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
        )}
        <div className="text-sm">
          <p className="font-semibold text-white">
            {isOffline ? 'Offline mode enabled' : 'Network recovery needed'}
          </p>
          <p className="mt-1 text-amber-50/85">
            {refreshError ?? `Showing the last synced clinician state from ${new Date(data.refreshedAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
