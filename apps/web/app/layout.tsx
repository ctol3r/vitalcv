import RootChrome from '@/components/layout/RootChrome';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from '@/components/ui/sonner';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { vdsCssVariables } from '@/src/styles';
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type React from 'react';
import './globals.css';
import '../styles/antigravity.css';
import '../styles/typography.css';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-inter-var',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-jetbrains-var',
});

const fontVariables = {
  '--font-fraunces': "'Fraunces', Georgia, serif",
  '--font-inter': "var(--font-inter-var), 'Inter', system-ui, sans-serif",
  '--font-plus-jakarta': "var(--font-inter-var), 'Inter', system-ui, sans-serif",
  '--font-jetbrains': "'JetBrains Mono', ui-monospace, monospace",
  ...vdsCssVariables,
} as React.CSSProperties;

export const metadata: Metadata = {
  title: 'VitalCV — Check Clinician Readiness in Seconds | Healthcare Credentialing',
  description: 'Reusable trust state for clinician credentialing.',
};

const clerkEnabled = CLERK_PROVIDER_ENABLED;

function parseInitialClerkRole(
  claims: Record<string, unknown> | undefined,
): string | null {
  const vitalcv = claims?.vitalcv;
  if (vitalcv && typeof vitalcv === 'object' && 'role' in vitalcv && typeof vitalcv.role === 'string') {
    return vitalcv.role;
  }

  if (typeof claims?.role === 'string') {
    return claims.role;
  }

  if (typeof claims?.org_role === 'string') {
    return claims.org_role;
  }

  return null;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialUserId: string | null = null;
  let initialClerkRole: string | null = null;

  if (clerkEnabled) {
    try {
      const session = await auth();
      initialUserId = session.userId ?? null;
      initialClerkRole = parseInitialClerkRole(session.sessionClaims as Record<string, unknown> | undefined);
    } catch {
      initialUserId = null;
      initialClerkRole = null;
    }
  }

  const hydratedContent = (
    <html
      lang="en"
      style={fontVariables}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Providers initialUserId={initialUserId} initialClerkRole={initialClerkRole}>
          <RootChrome clerkEnabled={clerkEnabled}>{children}</RootChrome>
          <CommandPalette />
          <Toaster position="top-right" closeButton richColors />
        </Providers>
      </body>
    </html>
  );

  if (!clerkEnabled) {
    return hydratedContent;
  }

  return <ClerkProvider>{hydratedContent}</ClerkProvider>;
}
