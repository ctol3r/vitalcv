'use client';

/**
 * Footer.tsx — Wave 64: Global Footer
 */

import Link from 'next/link';

const LINKS = [
  { href: '/developers', label: 'Developers' },
  { href: '/security', label: 'Security' },
  { href: '/docs', label: 'Docs' },
  { href: '/network', label: 'Status' },
];

export function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`border-t border-zinc-800 bg-zinc-950 ${className}`}>
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-zinc-600">© 2026 VitalCV, Inc. All rights reserved.</p>
        <div className="flex items-center gap-4">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
