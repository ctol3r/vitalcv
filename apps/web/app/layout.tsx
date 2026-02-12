import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from '@/components/ui/toaster';
import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';
import Providers from './providers';

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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-neutral-900 antialiased font-sans">
        <Providers>
          {children}
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
