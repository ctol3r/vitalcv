/**
 * Skip Link Component
 *
 * Allows keyboard users to skip navigation and go directly to main content
 * WCAG 2.1 Success Criterion 2.4.1: Bypass Blocks
 */

'use client'

/**
 * Skip to Main Content Link
 *
 * Add this at the very beginning of your layout
 *
 * @example
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <SkipLink />
 *         <Header />
 *         <main id="main-content">
 *           {children}
 *         </main>
 *       </body>
 *     </html>
 *   )
 * }
 */
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }: { href?: string; children?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:border-2 focus:border-primary"
    >
      {children}
    </a>
  )
}

/**
 * Skip Links (Multiple)
 *
 * Provide multiple skip links for complex layouts
 *
 * @example
 * <SkipLinks
 *   links={[
 *     { href: '#main-content', label: 'Skip to main content' },
 *     { href: '#navigation', label: 'Skip to navigation' },
 *     { href: '#search', label: 'Skip to search' },
 *   ]}
 * />
 */
export function SkipLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <ul className="fixed top-4 left-4 z-50 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="block bg-background text-foreground px-4 py-2 rounded-md border-2 border-primary hover:bg-accent focus:bg-accent"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
