'use client';

import Link from 'next/link';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 20);
  });

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 transition-colors duration-300"
      animate={{
        backgroundColor: scrolled
          ? 'rgba(255, 255, 255, 0.80)'
          : 'rgba(255, 255, 255, 0)',
        boxShadow: scrolled
          ? '0 4px 30px rgba(0, 0, 0, 0.05)'
          : '0 0 0 rgba(0, 0, 0, 0)',
        backdropFilter: scrolled ? 'blur(12px)' : 'blur(0px)',
      }}
      transition={{ duration: 0.25 }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-fraunces text-lg font-semibold text-[var(--warm-charcoal)] tracking-tight"
        >
          VitalCV
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-[var(--warm-charcoal)]/70">
          <a href="#how-it-works" className="hover:text-[var(--warm-charcoal)] transition-colors">
            How It Works
          </a>
          <a href="#security" className="hover:text-[var(--warm-charcoal)] transition-colors">
            Security
          </a>
          <a href="#portals" className="hover:text-[var(--warm-charcoal)] transition-colors">
            Portals
          </a>
          <Link href="/issuer" className="hover:text-[var(--warm-charcoal)] transition-colors">Issuer</Link>
          <Link href="/holder" className="hover:text-[var(--warm-charcoal)] transition-colors">Holder</Link>
          <Link href="/verifier" className="hover:text-[var(--warm-charcoal)] transition-colors">Verifier</Link>
          <Link href="/demo/ats" className="hover:text-[var(--warm-charcoal)] font-medium transition-colors text-teal-600">ATS Demo</Link>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/holder">Clinician Login</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/verifier">Book a Demo</Link>
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}
