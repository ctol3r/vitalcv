import type React from 'react';

import { cn } from '@/lib/utils';

export type PageDensityMode = 'marketing' | 'product' | 'workflow' | 'focused-form';

type PageFrameElement = 'div' | 'main' | 'section';

interface PageFrameProps extends React.HTMLAttributes<HTMLElement> {
  as?: PageFrameElement;
  mode: PageDensityMode;
}
/**
 * Canonical page-width and spacing boundary.
 *
 * Modes describe the job of the page, not a visual theme. Color and persona
 * remain owned by the surrounding surface; this primitive only standardizes
 * usable canvas, gutters, and vertical rhythm.
 */
export function PageFrame({
  as: Component = 'div',
  mode,
  className,
  children,
  ...props
}: PageFrameProps) {
  return (
    <Component
      data-page-density={mode}
      className={cn('vcv-page-frame', className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export function PageStack({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('vcv-page-stack', className)} {...props} />;
}
