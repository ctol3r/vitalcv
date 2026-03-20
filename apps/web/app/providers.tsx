'use client';

import { RoleProvider } from '@/components/auth/RoleContext';
import { ThemeProvider } from 'next-themes';
import type React from 'react';

export default function Providers({
  children,
  initialUserId,
  initialClerkRole,
}: {
  children: React.ReactNode;
  initialUserId: string | null;
  initialClerkRole: string | null;
}) {
  return (
    <RoleProvider initialUserId={initialUserId} initialClerkRole={initialClerkRole}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        themes={['light', 'dark', 'midnight', 'graphite']}
      >
        {children}
      </ThemeProvider>
    </RoleProvider>
  );
}
