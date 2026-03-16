'use client';

import { ThemeProvider } from 'next-themes';
import type React from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      themes={['light', 'dark', 'midnight', 'graphite']}
    >
      {children}
    </ThemeProvider>
  );
}
