'use client';

import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Footer links are `text-xs`, so their line box is only 16px tall — under the
 * 24×24 CSS-px floor in WCAG 2.2 AA 2.5.8 (Target Size, Minimum). `gap-4` gives
 * 16px between them, so the spacing exception does not rescue them either, and
 * they are standalone nav links rather than inline-in-a-sentence, so that
 * exception does not apply. Measured on production at a real 390×844 viewport:
 * six links at 16px tall.
 *
 * `inline-flex items-center min-h-[24px]` lifts the hit area to the floor while
 * leaving font size, colour and the text's optical position unchanged (the text
 * centres inside the taller box). Widths already pass — the narrowest, "DPA", is
 * 24px.
 */
const FOOTER_LINK_CLASS =
  'inline-flex items-center min-h-[24px] text-xs text-muted-foreground transition-colors hover:text-foreground';

const FOOTER_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/legal/dpa', label: 'DPA' },
  { href: '/legal/cookies', label: 'Cookies' },
  { href: '/pilot', label: 'Start a Pilot' },
] as const;

export default function Footer() {
  const pathname = usePathname();

  if (!isPublicSurfacePath(pathname)) {
    return null;
  }

  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-card">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} VitalCV
          </p>
          <nav className="flex items-center gap-4">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={FOOTER_LINK_CLASS}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/contact" className={FOOTER_LINK_CLASS}>
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
