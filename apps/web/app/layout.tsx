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
import { Fraunces, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type React from 'react';
import './globals.css';
import '../styles/typography.css';
import Providers from './providers';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  weight: ['400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/** Wave 168 — Interface Authority typography */
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
  weight: ['400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
  weight: ['400', '500', '600'],
});

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
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
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
