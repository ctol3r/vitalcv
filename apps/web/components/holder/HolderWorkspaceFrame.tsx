'use client';

import type { ReactNode } from 'react';
import { MobileBottomNav } from '@/components/clinician/MobileBottomNav';
import { ClinicianMobileProvider } from '@/components/mobile/ClinicianMobileProvider';
import ClinicianLaunchTracker from '@/components/mobile/ClinicianLaunchTracker';
import NetworkStatusBanner from '@/components/mobile/NetworkStatusBanner';
import type { ClinicianMobileData } from '@/lib/mobile/clinician-state';
import { RouteTrail } from '@/components/navigation/RouteTrail';
import { HolderDesktopNav } from './HolderDesktopNav';
import { HolderWorkspaceShell } from './HolderWorkspaceShell';
import { WorkbenchDock } from '@/components/workbench/WorkbenchDock';

/**
 * The visual and mobile-data frame shared by every holder route.
 *
 * Keeping this separate from the server-side auth layout lets interaction
 * tests render the exact holder chrome without weakening or bypassing Clerk.
 */
export function HolderWorkspaceFrame({
  children,
  initialData,
  showClerkAccount = true,
}: {
  children: ReactNode;
  initialData: ClinicianMobileData;
  showClerkAccount?: boolean;
}) {
  return (
    <ClinicianMobileProvider initialData={initialData}>
      <HolderWorkspaceShell>
        <a
          href="#holder-main"
          className="sr-only z-[60] rounded-md bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink-900)] focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <ClinicianLaunchTracker />
        <NetworkStatusBanner />
        <HolderDesktopNav showClerkAccount={showClerkAccount} />
        {/* UX-03: the holder tree already has a bar, so it takes the trail
            alone rather than ProductChrome (which would be a second header).
            The trail self-suppresses at depth 1, so /holder/home — where the
            nav's own active state already says where you are — stays clean. */}
        <RouteTrail />
        {/* Skip-link target. Deliberately a div: many holder pages render
            their own <main> landmark, so the frame must not add a second. */}
        <div
          id="holder-main"
          tabIndex={-1}
          className="flex-1 pb-[calc(var(--holder-mobile-bottom-nav-height)+env(safe-area-inset-bottom,0px)+1rem)] lg:pb-0"
        >
          {children}
        </div>
        <MobileBottomNav showClerkAccount={showClerkAccount} />
        {/* CC-07: the Workbench dock mounts ONLY here — the clinician chrome.
            It self-suppresses on /holder/garden/* (the full workspace owns
            that surface); a source-scan test pins this as the single mount. */}
        <WorkbenchDock />
      </HolderWorkspaceShell>
    </ClinicianMobileProvider>
  );
}
