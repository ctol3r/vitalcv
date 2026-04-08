'use client';

import { SignedIn } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import FeedbackButton from '@/components/feedback/FeedbackButton';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { PilotReporterHost } from '@/components/pilot-ops/PilotReporterHost';
import { PilotSignInTracker } from '@/components/pilot-ops/PilotSignInTracker';
import PrequalifyBar from '@/components/prequalify/PrequalifyBar';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import VCommandBar from '@/components/ops/VCommandBar';
import { OPS_SURFACE_PREFIXES } from '@/components/layout/publicSurfaceRoutes';

// Single source of truth lives in publicSurfaceRoutes.ts — do not maintain a local copy here.
function isOperationalRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return OPS_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

interface RootChromeProps {
  children: ReactNode;
  clerkEnabled: boolean;
}

export default function RootChrome({ children, clerkEnabled }: RootChromeProps) {
  const pathname = usePathname();
  const operationalRoute = isOperationalRoute(pathname);
  const pilotReporter = (
    <Suspense fallback={null}>
      <PilotReporterHost />
    </Suspense>
  );

  if (operationalRoute) {
    return (
      <>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--vt-accent)] focus:px-4 focus:py-2 focus:text-white focus:shadow-lg">Skip to main content</a>
        <div id="main-content" className="relative min-h-screen">{children}</div>
        {clerkEnabled ? pilotReporter : null}
        <FeedbackButton />
        {clerkEnabled ? <PilotSignInTracker /> : null}
        <VCommandBar />
      </>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--vt-accent)] focus:px-4 focus:py-2 focus:text-white focus:shadow-lg">Skip to main content</a>
      <Navbar />
      {clerkEnabled ? (
        <SignedIn>
          <WorkspaceSwitcher />
        </SignedIn>
      ) : null}
      <div id="main-content" className="relative flex-1">{children}</div>
      <Footer />
      <FeedbackButton />
      {clerkEnabled ? (
        <SignedIn>
          <PrequalifyBar />
        </SignedIn>
      ) : null}
      {clerkEnabled ? pilotReporter : null}
      {clerkEnabled ? <PilotSignInTracker /> : null}
      <VCommandBar />
    </div>
  );
}
