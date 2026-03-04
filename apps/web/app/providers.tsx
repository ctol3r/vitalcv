'use client';

import { ThemeProvider } from 'next-themes';
import type React from 'react';
import { CursorPhysics } from '@/components/ui/CursorPhysics';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <CursorPhysics>{children}</CursorPhysics>
    </ThemeProvider>
  );
}

