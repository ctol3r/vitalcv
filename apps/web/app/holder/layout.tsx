import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ClinicianMobileProvider } from '@/components/mobile/ClinicianMobileProvider';
import ClinicianLaunchTracker from '@/components/mobile/ClinicianLaunchTracker';
import NetworkStatusBanner from '@/components/mobile/NetworkStatusBanner';
import { MobileBottomNav } from '@/components/clinician/MobileBottomNav';
import { HolderDesktopNav } from '@/components/holder/HolderDesktopNav';
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
      {/* The clinician workspace is a fixed-dark "instrument" surface
          (bg-ops-gradient). Pin the subtree to `dark` so every themed token
          (text-foreground, .mz, .vcv-doc, Calm Wave --ink/--card) resolves to
          its dark-mode value — otherwise the light-default global theme leaves
          theme-aware text dark-on-dark (invisible). text-white content is
          unaffected. Full in-workspace light mode is a follow-up migration. */}
      <div className="dark mz mz-persona-holder flex min-h-screen flex-col bg-ops-gradient selection:bg-vt-info/30 text-foreground">
        <ClinicianLaunchTracker />
        <NetworkStatusBanner />
        <HolderDesktopNav />
        <div className="flex-1 pb-20 md:pb-0">{children}</div>
        <MobileBottomNav />
      </div>
    </ClinicianMobileProvider>
  );
}
