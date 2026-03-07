import FeedbackButton from '@/components/feedback/FeedbackButton';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { BackgroundField } from '@/components/motion/BackgroundField';
import { CursorPhysics } from '@/components/motion/CursorPhysics';
import { Toaster } from '@/components/ui/toaster';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import type React from 'react';
import './globals.css';
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
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {/* Wave 11: Tactile grain overlay — fixed, pointer-events:none, z-50 */}
        <div aria-hidden="true" className="noise-overlay" />
        <Providers>
          <BackgroundField />
          <CursorPhysics />
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <div className="relative flex-1">{children}</div>
            <Footer />
          </div>
          <Toaster />
          <FeedbackButton />
        </Providers>
      </body>
    </html>
  );

  if (!clerkEnabled) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
