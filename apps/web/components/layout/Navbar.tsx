'use client';

/**
 * Navbar.tsx — Wave 64: Global Navigation Bar
 *
 * Appears on /, /demo, /network, /simulation, /mobile.
 * Matches the infrastructure platform visual language.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface NavLink {
  href: string;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'VitalCV' },
  { href: '/demo/run', label: 'Demo' },
  { href: '/network', label: 'Network' },
  { href: '/developers', label: 'Developers' },
  { href: '/verifier', label: 'Verifier' },
];

// ── Component ─────────────────────────────────────────────────────────────

export function Navbar({ className = '' }: { className?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);

  return (
    <nav className={`border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-zinc-100 hover:text-white transition-colors">
          <span className="w-6 h-6 rounded bg-emerald-600/20 flex items-center justify-center text-[10px]">◎</span>
          VitalCV
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.slice(1).map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link key={link.href} href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active ? 'text-white bg-white/[0.06]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                }`}>
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Sign In */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/sign-in"
            className="px-4 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up"
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white transition-colors">
            Get Started
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button onClick={toggleMobile} className="md:hidden text-zinc-400 hover:text-white p-1">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {mobileOpen ? (
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path d="M3 6H17M3 10H17M3 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-zinc-800 overflow-hidden"
          >
            <div className="px-6 py-3 space-y-1">
              {NAV_LINKS.slice(1).map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.03] transition-colors">
                  {link.label}
                </Link>
              ))}
              <Link href="/sign-in" onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm text-zinc-500 hover:text-white transition-colors">
                Sign In
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default Navbar;
