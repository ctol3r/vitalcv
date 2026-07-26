'use client';

import type { ReactNode } from 'react';
import { MobileBottomNav } from '@/components/clinician/MobileBottomNav';
import { ClinicianMobileProvider } from '@/components/mobile/ClinicianMobileProvider';
import ClinicianLaunchTracker from '@/components/mobile/ClinicianLaunchTracker';
import NetworkStatusBanner from '@/components/mobile/NetworkStatusBanner';
import type { ClinicianMobileData } from '@/lib/mobile/clinician-state';
import { HolderDesktopNav } from './HolderDesktopNav';
import { HolderWorkspaceShell } from './HolderWorkspaceShell';

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
        <ClinicianLaunchTracker />
        <NetworkStatusBanner />
        <HolderDesktopNav showClerkAccount={showClerkAccount} />
        <div className="flex-1 pb-[calc(var(--holder-mobile-bottom-nav-height)+env(safe-area-inset-bottom,0px)+1rem)] lg:pb-0">
          {children}
        </div>
        <MobileBottomNav showClerkAccount={showClerkAccount} />
      </HolderWorkspaceShell>
    </ClinicianMobileProvider>
  );
}
