'use client';

import { SignedIn } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import Eyebrow from '@/components/layout/Eyebrow';
import FeedbackButton from '@/components/feedback/FeedbackButton';
import Footer from '@/components/layout/Footer';
import { PilotReporterHost } from '@/components/pilot-ops/PilotReporterHost';
import { PilotSignInTracker } from '@/components/pilot-ops/PilotSignInTracker';
import PrequalifyBar from '@/components/prequalify/PrequalifyBar';
import { ProductChrome } from '@/components/navigation/ProductChrome';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import VCommandBar from '@/components/ops/VCommandBar';
import { isOpsSurfacePath } from '@/components/layout/publicSurfaceRoutes';

// Single source of truth lives in publicSurfaceRoutes.ts — do not maintain a
// local copy here. isOpsSurfacePath also owns the per-route exemptions
// (e.g. /design/z1-home renders with the public chrome).
const isOperationalRoute = isOpsSurfacePath;

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
        <div className="relative min-h-screen">{children}</div>
        {clerkEnabled ? pilotReporter : null}
        <FeedbackButton />
        {clerkEnabled ? <PilotSignInTracker /> : null}
        <VCommandBar />
      </>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
      >
        Skip to content
      </a>
      {/* UX-V1: the architectural eyebrow replaces Navbar + AnnouncementRail on
          public surfaces. Navbar, AnnouncementRail, HeaderMenu, LiquidMenu and
          JourneyRail are parked, not deleted — see
          docs/design/PARKED_VISUAL_ERAS.md. */}
      <Eyebrow />
      {/* UX-03: the signed-in counterpart. Eyebrow and ProductChrome are
          mutually exclusive by registry — each returns null on the other's
          surfaces — so exactly one 64px instrument ever renders. Mounted here
          rather than in four subtree layouts so a new console cannot ship
          without chrome by forgetting a layout file. */}
      <ProductChrome />
      {clerkEnabled ? (
        <SignedIn>
          <WorkspaceSwitcher />
        </SignedIn>
      ) : null}
      {/* tabIndex makes the skip-link target actually receive focus. It stays a
          <div>: nearly every page renders its own <main>, so promoting this
          wrapper would nest main landmarks site-wide. */}
      <div id="main-content" tabIndex={-1} className="relative flex-1">{children}</div>
      {/* The UX-V1 homepage composes its own final CTA + footer band; the
          shared Footer would double it. Every other public surface keeps the
          shared Footer unchanged. */}
      {pathname === '/' ? null : <Footer />}
      <FeedbackButton />
      {clerkEnabled ? (
        <SignedIn>
          <PrequalifyBar />
        </SignedIn>
      ) : null}
      {clerkEnabled ? pilotReporter : null}
      {clerkEnabled ? <PilotSignInTracker /> : null}
      {/* VCommandBar is operator tooling — mounted only on operational routes
          (above). Public / clinician surfaces use the clinician CommandPalette
          (mounted in the root layout), which owns "/" and ⌘K here. */}
    </div>
  );
}
