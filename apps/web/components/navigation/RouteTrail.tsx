'use client';

/**
 * RouteTrail — UX-03's breadcrumb.
 *
 * Derived from the route manifest, so it is correct by construction on the
 * eleven dynamic routes where a pathname split renders "[applicationId]".
 *
 * Accessibility: a labelled <nav> wrapping an <ol>, the current page marked
 * aria-current="page", separators aria-hidden so a screen reader hears the
 * labels rather than a run of chevrons. Links clear the 44px EC-5 target on
 * touch via padding, not a fixed height, so the row stays
 * one line.
 *
 * Mobile: only the parent and the current page are shown from the small end —
 * a five-deep trail wraps to three lines at 390px and pushes the page content
 * below the fold. The dropped ancestors remain reachable through the product
 * bar's section link, so nothing becomes unnavigable.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { resolveTrail, type TrailItem } from '@/lib/navigation/routeManifest';

export function RouteTrail({
  labels,
  className = '',
}: {
  /** Resolved human names for dynamic crumbs, keyed by route pattern. */
  labels?: Record<string, string>;
  className?: string;
}) {
  const pathname = usePathname() ?? '/';
  const trail = resolveTrail(pathname, labels);

  // A single crumb is the section root itself — the bar already names it, so a
  // one-item breadcrumb would be pure duplication.
  if (trail.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className={`vcv-trail ${className}`.trim()}>
      <ol className="vcv-trail__list">
        {trail.map((item, index) => (
          <li key={`${item.label}-${index}`} className="vcv-trail__item" data-depth={index}>
            {index > 0 && (
              <span className="vcv-trail__sep" aria-hidden="true">
                /
              </span>
            )}
            <Crumb item={item} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Crumb({ item }: { item: TrailItem }) {
  if (item.current) {
    return (
      <span className="vcv-trail__crumb vcv-trail__crumb--current" aria-current="page">
        {item.label}
      </span>
    );
  }
  if (!item.href) {
    // An unlinked waypoint: it names a level that has no page of its own.
    return <span className="vcv-trail__crumb vcv-trail__crumb--plain">{item.label}</span>;
  }
  return (
    <Link href={item.href} className="vcv-trail__crumb vcv-trail__crumb--link">
      {item.label}
    </Link>
  );
}

export default RouteTrail;
