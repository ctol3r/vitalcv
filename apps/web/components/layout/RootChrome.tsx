'use client';

import { SignedIn } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import FeedbackButton from '@/components/feedback/FeedbackButton';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import PrequalifyBar from '@/components/prequalify/PrequalifyBar';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import VCommandBar from '@/components/ops/VCommandBar';

const OPERATIONAL_ROUTES = [
  '/graph',
  '/intelligence',
  '/findings',
  '/storylines',
  '/actions',
  '/providers',
  '/investigations',
  '/calibration',
  '/system-health',
  '/network',
] as const;

function isOperationalRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return OPERATIONAL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

interface RootChromeProps {
  children: ReactNode;
  clerkEnabled: boolean;
}

export default function RootChrome({ children, clerkEnabled }: RootChromeProps) {
  const pathname = usePathname();
  const operationalRoute = isOperationalRoute(pathname);

  if (operationalRoute) {
    return (
      <>
        <div className="relative min-h-screen">{children}</div>
        <VCommandBar />
      </>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      {clerkEnabled ? (
        <SignedIn>
          <WorkspaceSwitcher />
        </SignedIn>
      ) : null}
      <div className="relative flex-1">{children}</div>
      <Footer />
      <FeedbackButton />
      {clerkEnabled ? (
        <SignedIn>
          <PrequalifyBar />
        </SignedIn>
      ) : null}
      <VCommandBar />
    </div>
  );
}
