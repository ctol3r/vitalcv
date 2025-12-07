/**
 * B246B-DES-014: ThemeToggle component
 *
 * UI component to switch between light/dark (or custom) themes.
 * Displays icons, accessible with focus states and ARIA labels.
 * Calls useTheme() to toggle theme.
 * Persists preference in local storage.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
// Note: In production, this should be imported from a published package
// For now, using relative import. Consider setting up path aliases or package exports.
import { useTheme } from '../../../../services/design-system/theme/ThemeProvider';
import { cn } from '@/lib/utils';

/**
 * ThemeToggle props
 */
export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'button' | 'select' | 'toggle';
}

/**
 * ThemeToggle component
 */
export function ThemeToggle({
  className,
  showLabel = false,
  variant = 'button',
}: ThemeToggleProps) {
  const { mode, setMode, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn('inline-flex items-center gap-2', className)}>
        <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
      </div>
    );
  }

  if (variant === 'select') {
    return (
      <div className={cn('inline-flex items-center gap-2', className)}>
        {showLabel && (
          <label htmlFor="theme-select" className="text-sm font-medium">
            Theme:
          </label>
        )}
        <select
          id="theme-select"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'light' | 'dark' | 'system')}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Select theme"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>
    );
  }

  if (variant === 'toggle') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md p-2',
          'text-foreground hover:bg-accent hover:text-accent-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'transition-colors duration-200',
          'aria-label="Toggle theme"',
          className
        )}
        aria-label="Toggle theme"
        aria-pressed={mode === 'dark'}
      >
        {mode === 'light' ? (
          <Sun className="h-5 w-5" aria-hidden="true" />
        ) : mode === 'dark' ? (
          <Moon className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Monitor className="h-5 w-5" aria-hidden="true" />
        )}
        {showLabel && (
          <span className="text-sm font-medium">
            {mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'}
          </span>
        )}
      </button>
    );
  }

  // Default button variant with dropdown
  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md border border-input',
          'bg-background px-3 py-2 text-sm font-medium',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'transition-colors duration-200',
          'disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        aria-label={`Current theme: ${mode}. Click to toggle theme.`}
        aria-expanded={false}
      >
        {mode === 'light' ? (
          <>
            <Sun className="h-4 w-4" aria-hidden="true" />
            {showLabel && <span>Light</span>}
          </>
        ) : mode === 'dark' ? (
          <>
            <Moon className="h-4 w-4" aria-hidden="true" />
            {showLabel && <span>Dark</span>}
          </>
        ) : (
          <>
            <Monitor className="h-4 w-4" aria-hidden="true" />
            {showLabel && <span>System</span>}
          </>
        )}
      </button>
    </div>
  );
}

