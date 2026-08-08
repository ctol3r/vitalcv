'use client';

import { FOOTER_NAV } from '@/components/layout/navDestinations';
import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Footer links are `text-xs`, so their line box is only 16px tall — under the
 * 24×24 CSS-px floor in WCAG 2.2 AA 2.5.8 (Target Size, Minimum). `gap-4` gives
 * 16px between them, so the spacing exception does not rescue them either, and
 * they are standalone nav links rather than inline-in-a-sentence, so that
 * exception does not apply. Measured on production at a real 390×844 viewport:
 * six links at 16px tall (eight since W1079 added Trust and Status).
 *
 * `inline-flex items-center min-h-[24px]` lifts the hit area to the floor while
 * leaving font size, colour and the text's optical position unchanged (the text
 * centres inside the taller box).
 *
 * Widths were recorded here as already passing — "the narrowest, DPA, is 24px".
 * Measured at 390×844 against production, DPA is **23×24**: one pixel under the
 * same floor the height fix was written for, and under it on the live site
 * before this wave touched anything. `min-w-[24px]` closes it; `justify-center`
 * keeps the label optically centred in the slightly wider box. Both dimensions
 * are asserted in footer-tap-targets, so the width cannot regress the way it
 * did while only the height was guarded.
 */
const FOOTER_LINK_CLASS =
  'inline-flex items-center justify-center min-h-[24px] min-w-[24px] text-xs text-muted-foreground transition-colors hover:text-foreground';

/**
 * W1079 moved Trust and Status off the eyebrow bar into FOOTER_NAV, and this
 * renders it. The wave asks for them "behind a compact How it works or footer
 * path" — the footer is that path, and it is the honest place for them: a
 * visitor looking for what VitalCV does and does not decide is not choosing
 * between it and a job, they are checking a claim they have already read.
 * Reachable from every public surface, competing with nothing.
 *
 * The list itself lives in navDestinations.ts so the bar, the index menu and
 * this footer stay one information architecture rather than three arrays.
 */

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
          {/*
            * `flex-wrap` is load-bearing after W1079 took the row from six
            * links to eight. Without it the row is a single unwrapped line at
            * 390px and the last items hang past the viewport — and an
            * `overflow-x: hidden` ancestor means `scrollWidth - clientWidth`
            * still measures 0, so the e2e asserts element right edges instead.
            */}
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end">
            {FOOTER_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={FOOTER_LINK_CLASS}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
