import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { HolderWorkspaceFrame } from '@/components/holder/HolderWorkspaceFrame';
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
    <HolderWorkspaceFrame initialData={initialData}>
      {children}
    </HolderWorkspaceFrame>
  );
}
