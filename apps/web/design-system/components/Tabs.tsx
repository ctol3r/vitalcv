'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex rounded-[var(--vt-radius-pill)] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-[var(--vt-space-4)]',
      className,
    )}
    {...props}
  />
));

TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // CD-10: chrome is 10px, never a pill. CD-15: 44px floor — `min-h-9` was 36px.
      'inline-flex min-h-11 items-center justify-center rounded-[10px] px-[var(--vt-space-16)] text-[length:var(--vt-type-meta-size)] font-[var(--vt-font-weight-medium)] text-[var(--vt-text-secondary)]',
      'transition-[background-color,color] duration-[var(--vt-motion-control)] ease-[var(--vt-ease-standard)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vt-bg)]',
      'data-[state=active]:bg-[var(--vt-surface)] data-[state=active]:text-[var(--vt-text-primary)]',
      className,
    )}
    {...props}
  />
));

TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-[var(--vt-space-16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vt-bg)]',
      className,
    )}
    {...props}
  />
));

TabsContent.displayName = TabsPrimitive.Content.displayName;
