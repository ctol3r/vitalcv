import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ClinicianMobileProvider } from '@/components/mobile/ClinicianMobileProvider';
import ClinicianLaunchTracker from '@/components/mobile/ClinicianLaunchTracker';
import NetworkStatusBanner from '@/components/mobile/NetworkStatusBanner';
import { MobileBottomNav } from '@/components/clinician/MobileBottomNav';
import { HolderDesktopNav } from '@/components/holder/HolderDesktopNav';
import { HolderWorkspaceShell } from '@/components/holder/HolderWorkspaceShell';
import { loadClinicianMobileData } from '@/lib/mobile/server';

export const metadata: Metadata = {
  title: 'Clinician Workspace',
  description: 'Your verified medical credential wallet and opportunities.',
};

// Session-sensitive tree (Wave 0.2): the holder workspace is per-user.
// Never prerender, never shared-cache.
export const dynamic = 'force-dynamic';

export default async function HolderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session.userId) {
    redirect('/sign-in?redirect_url=/holder/home');
  }

  const initialData = await loadClinicianMobileData(session);

  return (
    <ClinicianMobileProvider initialData={initialData}>
      {/* VitalCV is light-only. HolderWorkspaceShell renders the workspace on
          light `.mz` paper; dark-authored surfaces stay readable via
          styles/holder-light-compat.css. */}
      <HolderWorkspaceShell>
        <ClinicianLaunchTracker />
        <NetworkStatusBanner />
        <HolderDesktopNav />
        <div className="flex-1 pb-20 md:pb-0">{children}</div>
        <MobileBottomNav />
      </HolderWorkspaceShell>
    </ClinicianMobileProvider>
  );
}
