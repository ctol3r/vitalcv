import { Toaster } from '@/components/ui/toaster';
import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'VitalCV',
  description: 'Canonical path verification only.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
