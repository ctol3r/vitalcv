import * as React from 'react';

/**
 * Wraps a route in the visual-system shell (.vs-root). Tokens, fonts, and
 * component styles are scoped under this class to avoid colliding with the
 * existing globals.css design system.
 *
 * Usage:
 *   export default function Page() {
 *     return <Shell><Nav /><main>…</main><Footer /></Shell>;
 *   }
 */
export function Shell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`vs-root${className ? ` ${className}` : ''}`}>{children}</div>;
}
