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
      {/* Workspace gets its own light/dark theme (default dark — the verified
          instrument look), toggled from the nav. HolderWorkspaceShell owns the
          `dark`/`mz-paper` class + the theme context. Home surface is fully
          `.mz` and renders in both; other full-page surfaces are being migrated
          to `.mz` and look best in dark until then (hence dark stays default). */}
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
