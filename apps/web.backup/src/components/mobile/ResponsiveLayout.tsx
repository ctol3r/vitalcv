/**
 * ResponsiveLayout Framework
 * Task: B244C-MOF-025
 *
 * Provides responsive breakpoints and layout utilities
 * Grid system, spacing, container widths
 * Ensures pages adapt to mobile, tablet, desktop
 * Uses Tailwind CSS
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Breakpoint utilities
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Container widths
export const containerWidths = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  full: '100%',
} as const;

// Spacing scale (matches Tailwind)
export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

interface ContainerProps {
  children: ReactNode;
  maxWidth?: keyof typeof containerWidths;
  className?: string;
  padding?: boolean;
}

export function Container({
  children,
  maxWidth = 'xl',
  className,
  padding = true,
}: ContainerProps) {
  return (
    <div
      className={cn(
        'w-full mx-auto',
        padding && 'px-4 sm:px-6 lg:px-8',
        maxWidth === 'sm' && 'max-w-sm',
        maxWidth === 'md' && 'max-w-md',
        maxWidth === 'lg' && 'max-w-lg',
        maxWidth === 'xl' && 'max-w-xl',
        maxWidth === '2xl' && 'max-w-2xl',
        maxWidth === 'full' && 'max-w-full',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface GridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: keyof typeof spacing;
  className?: string;
}

export function Grid({ children, cols = 1, gap = 4, className }: GridProps) {
  return (
    <div
      className={cn(
        'grid',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'grid-cols-1 sm:grid-cols-2',
        cols === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        cols === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        cols === 6 && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
        cols === 12 && 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-12',
        `gap-${gap}`,
        className,
      )}
    >
      {children}
    </div>
  );
}

interface StackProps {
  children: ReactNode;
  direction?: 'row' | 'col';
  gap?: keyof typeof spacing;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  className?: string;
}

export function Stack({
  children,
  direction = 'col',
  gap = 4,
  align,
  justify,
  className,
}: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'col' ? 'flex-col' : 'flex-row',
        `gap-${gap}`,
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
        align === 'stretch' && 'items-stretch',
        justify === 'start' && 'justify-start',
        justify === 'center' && 'justify-center',
        justify === 'end' && 'justify-end',
        justify === 'between' && 'justify-between',
        justify === 'around' && 'justify-around',
        justify === 'evenly' && 'justify-evenly',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ResponsiveLayoutProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveLayout({ children, className }: ResponsiveLayoutProps) {
  return (
    <div className={cn('min-h-screen w-full', className)}>
      {children}
    </div>
  );
}

// Example usage component
export function ResponsiveLayoutExample() {
  return (
    <ResponsiveLayout>
      <Container maxWidth="xl" padding>
        <Stack gap={6}>
          <h1 className="text-2xl font-bold">Responsive Layout Example</h1>
          <Grid cols={3} gap={4}>
            <div className="p-4 bg-card rounded-lg border">Card 1</div>
            <div className="p-4 bg-card rounded-lg border">Card 2</div>
            <div className="p-4 bg-card rounded-lg border">Card 3</div>
          </Grid>
        </Stack>
      </Container>
    </ResponsiveLayout>
  );
}

