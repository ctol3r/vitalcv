'use client';

import { Button } from '@/components/ui/button';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const NAV_LINKS: ReadonlyArray<{ readonly href: string; readonly label: string; readonly isRoute?: boolean }> = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#security',     label: 'Security'      },
  { href: '#portals',      label: 'Portals'        },
  { href: '/developers',   label: 'Developers', isRoute: true },
  { href: '/issuer',       label: 'Issuer',     isRoute: true },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close mobile menu on ESC
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <motion.nav
      className={`fixed top-0 w-full z-50 border-b transition-all duration-500 ${
        isScrolled
          ? 'border-[var(--warm-charcoal)]/15 bg-[var(--cloud-dancer)]/85 backdrop-blur-md shadow-[0_12px_30px_rgba(18,20,20,0.08)]'
          : 'border-transparent bg-[var(--cloud-dancer)]/0'
      }`}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-fraunces text-lg font-semibold text-[var(--warm-charcoal)] tracking-tight"
        >
          VitalCV
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-[var(--warm-charcoal)]/70">
          {NAV_LINKS.map((link) =>
            link.isRoute ? (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-[var(--warm-charcoal)] transition-colors font-medium"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-[var(--warm-charcoal)] transition-colors"
              >
                {link.label}
              </a>
            ),
          )}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <MagneticButton>
            <Button asChild variant="ghost" size="sm">
              <Link href="/holder">Clinician Login</Link>
            </Button>
          </MagneticButton>
          <MagneticButton>
            <Button asChild size="sm">
              <Link href="/demo">Book a Demo</Link>
            </Button>
          </MagneticButton>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-[var(--warm-charcoal)]"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="md:hidden border-t border-[var(--warm-charcoal)]/10 bg-[var(--cloud-dancer)]/95 backdrop-blur-md"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="px-6 py-4 space-y-3">
              {NAV_LINKS.map((link) =>
                link.isRoute ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMobile}
                    className="block text-sm text-[var(--warm-charcoal)]/70 hover:text-[var(--warm-charcoal)] transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMobile}
                    className="block text-sm text-[var(--warm-charcoal)]/70 hover:text-[var(--warm-charcoal)] transition-colors"
                  >
                    {link.label}
                  </a>
                ),
              )}
              <div className="flex flex-col gap-2 pt-2">
                <MagneticButton className="flex">
                  <Button asChild variant="ghost" size="sm" onClick={closeMobile} className="w-full">
                    <Link href="/holder">Clinician Login</Link>
                  </Button>
                </MagneticButton>
                <MagneticButton className="flex">
                  <Button asChild size="sm" onClick={closeMobile} className="w-full">
                    <Link href="/demo">Book a Demo</Link>
                  </Button>
                </MagneticButton>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.nav>
  );
}
