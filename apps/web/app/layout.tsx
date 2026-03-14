import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import FeedbackButton from '@/components/feedback/FeedbackButton';
import PrequalifyBar from '@/components/prequalify/PrequalifyBar';
import Omnibar from '@/components/ops/Omnibar';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { BackgroundField } from '@/components/motion/BackgroundField';
import { CursorPhysics } from '@/components/motion/CursorPhysics';
import { Toaster } from '@/components/ui/toaster';
import { ClerkProvider, SignedIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';
import '../styles/antigravity.css';
import '../styles/typography.css';
import Providers from './providers';

const fontVariables = {
  '--font-fraunces': "'Fraunces', Georgia, serif",
  '--font-inter': "'Inter', system-ui, sans-serif",
  '--font-plus-jakarta': "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  '--font-jetbrains': "'JetBrains Mono', ui-monospace, monospace",
} as React.CSSProperties;

export const metadata: Metadata = {
  title: 'VitalCV',
  description: 'Reusable trust state for clinician credentialing.',
};

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en" style={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {/* Wave 11: Tactile grain overlay — fixed, pointer-events:none, z-50 */}
        <div aria-hidden="true" className="noise-overlay" />
        <Providers>
          <BackgroundField />
          <CursorPhysics />
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            {clerkEnabled ? (
              <SignedIn>
                <WorkspaceSwitcher />
              </SignedIn>
            ) : null}
            <div className="relative flex-1">{children}</div>
            <Footer />
          </div>
          <Toaster />
          <FeedbackButton />
          <PrequalifyBar />
          <Omnibar />
        </Providers>
      </body>
    </html>
  );

  if (!clerkEnabled) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
