import RootChrome from '@/components/layout/RootChrome';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from '@/components/ui/toaster';
import { vdsCssVariables } from '@/src/styles';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Nunito_Sans } from 'next/font/google';
import type React from 'react';
import './globals.css';
import '../styles/antigravity.css';
import '../styles/typography.css';
import Providers from './providers';

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-nunito-sans',
});

const fontVariables = {
  '--font-fraunces': "'Fraunces', Georgia, serif",
  '--font-inter': "var(--font-nunito-sans), 'Nunito Sans', system-ui, sans-serif",
  '--font-plus-jakarta': "var(--font-nunito-sans), 'Nunito Sans', system-ui, sans-serif",
  '--font-jetbrains': "'JetBrains Mono', ui-monospace, monospace",
  ...vdsCssVariables,
} as React.CSSProperties;

export const metadata: Metadata = {
  title: 'VitalCV',
  description: 'Reusable trust state for clinician credentialing.',
};

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const localBackendConfigured = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').includes('localhost');
const clerkEnabled = Boolean(clerkPublishableKey)
  && !(localBackendConfigured && clerkPublishableKey.startsWith('pk_live_'));

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html
      lang="en"
      style={fontVariables}
      suppressHydrationWarning
      className={nunitoSans.variable}
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {/* Grain overlay removed — FE12 design simplification */}
        <Providers>
          <RootChrome clerkEnabled={clerkEnabled}>{children}</RootChrome>
          <CommandPalette />
          <Toaster />
        </Providers>
      </body>
    </html>
  );

  if (!clerkEnabled) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
