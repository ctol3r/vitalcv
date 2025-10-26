'use client';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';
import * as React from 'react';

interface EnhancedThemeProviderProps extends ThemeProviderProps {
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  enableSystem = true,
  disableTransitionOnChange = false,
  storageKey = 'vitalcv-theme',
  ...props
}: EnhancedThemeProviderProps) {
  // Disable transitions during theme changes to prevent flash
  React.useEffect(() => {
    if (disableTransitionOnChange) {
      const css = document.createElement('style');
      css.appendChild(
        document.createTextNode(
          `*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`,
        ),
      );
      document.head.appendChild(css);

      return () => {
        // Force reflow
        (() => window.getComputedStyle(document.body))();
        // Remove the style element after a short delay
        setTimeout(() => {
          document.head.removeChild(css);
        }, 1);
      };
    }
  }, [disableTransitionOnChange]);

  return (
    <NextThemesProvider
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
      storageKey={storageKey}
      attribute="class"
      defaultTheme="system"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

// Enhanced theme provider with additional features
export function EnhancedThemeProvider({ children, ...props }: EnhancedThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="opacity-0">{children}</div>;
  }

  return <ThemeProvider {...props}>{children}</ThemeProvider>;
}
