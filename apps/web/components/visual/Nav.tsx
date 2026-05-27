import Link from 'next/link';
import * as React from 'react';
import { CmdPill } from './primitives';

/**
 * Global Nav for the ported visual-system routes.
 *
 * chat22 fix #9 (also): ⌘K command pill is now GLOBAL (was /passport-only).
 * Pass `showCmdPill={false}` only on the auth split layout where it would
 * compete with the form for attention.
 *
 * chat22 fix #9 (nav status pill): the CSS handles the 980–1180px tighten
 * via `.vs-nav-status` collapsing to dot-on-hover at that breakpoint.
 */

type NavLink = { href: string; label: string };

const DEFAULT_LINKS: NavLink[] = [
  { href: '/', label: 'Overview' },
  { href: '/passport?npi=1699264564', label: 'Passport' },
  { href: '/trust', label: 'Trust' },
  { href: '/trust/attribution', label: 'Attribution' },
  { href: '/status', label: 'Status' },
];

type StatusVariant = 'ok' | 'degraded';
type StatusInfo = { label: string; variant?: StatusVariant };

export type NavProps = {
  /** Override the link set. Defaults to Overview · Passport · Trust · Attribution · Status. */
  links?: NavLink[];
  /** Status pill on the right. Pass `null` to hide. */
  status?: StatusInfo | null;
  /** Right-side CTA pair. Pass `null` to hide. */
  cta?: React.ReactNode;
  /** Show ⌘K command pill. Defaults to true. */
  showCmdPill?: boolean;
  /** Mark a link as active. Match by href (the path portion, before `?`).
   *  Pages know their own route — passing this avoids the client-only
   *  `usePathname` hook, which keeps Nav server-renderable. */
  activePath?: string;
  className?: string;
};

const DEFAULT_STATUS: StatusInfo = {
  label: '3 of 4 connectors responding',
  variant: 'ok',
};

export function Nav({
  links = DEFAULT_LINKS,
  status = DEFAULT_STATUS,
  cta,
  showCmdPill = true,
  activePath,
  className,
}: NavProps) {
  // Nav is server-renderable so the route pages don't need `'use client'`
  // just to mount it. Active-link highlighting comes from the caller's
  // `activePath` (the route already knows what page it is).
  function isActive(href: string): boolean {
    if (!activePath) return false;
    const [pathOnly] = href.split('?');
    if (pathOnly === '/') return activePath === '/';
    return activePath === pathOnly || activePath.startsWith(`${pathOnly}/`);
  }

  return (
    <nav className={`vs-nav${className ? ` ${className}` : ''}`}>
      <div className="vs-nav-in">
        <Link href="/" className="vs-brand">
          <span className="vs-glyph">V</span>
          <span>VitalCV</span>
          <span className="vs-ver">PREVIEW</span>
        </Link>
        <div className="vs-nav-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link.href) ? 'active' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="vs-nav-right">
          {showCmdPill ? <CmdPill className="vs-no-on-narrow" /> : null}
          {status ? (
            <span
              className={`vs-nav-status${status.variant === 'degraded' ? ' degraded' : ''}`}
            >
              <span className="vs-dot" />
              <span>{status.label}</span>
            </span>
          ) : null}
          {cta}
        </div>
      </div>
    </nav>
  );
}
