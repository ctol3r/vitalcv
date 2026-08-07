'use client';

/**
 * HeaderMenu — the expanded navigation canvas (desktop).
 *
 * Not a dropdown: the bar itself unfolds full-width (the grid-rows 0fr→1fr
 * mechanism from #1068, kept because it animates to the content's real
 * height without measuring), and what it reveals is one editorial canvas —
 * every group visible in a deliberate spatial composition, the way Palantir
 * lists its navigation under a small eyebrow rather than hanging five equal
 * links in the bar. One panel; never two (Z3 rule).
 *
 * The left column restates the journey so the canvas visibly relates to the
 * rail above it. Destinations come from navDestinations — the same source
 * the mobile overlay consumes.
 */

import Link from 'next/link';
import { NAV_GROUPS } from './navDestinations';
import { JourneyRail } from './JourneyRail';
import { isRouteActive } from './publicSurfaceRoutes';
import type { JourneyStageId } from './journeyStages';

export function HeaderMenu({
  open,
  pathname,
  stage,
  railInteractive,
  onNavigate,
}: {
  open: boolean;
  pathname: string;
  stage: JourneyStageId;
  railInteractive: boolean;
  onNavigate: (label: string) => void;
}) {
  return (
    <div
      className={`hidden md:grid vcv-menu ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      data-menu-open={open ? '' : undefined}
    >
      <div className="overflow-hidden">
        <div
          id="vcv-header-menu"
          role="region"
          aria-label="Site navigation"
          hidden={!open}
          className="mx-auto grid max-w-7xl grid-cols-[minmax(0,20rem)_1fr] gap-x-16 border-t px-5 pb-12 pt-8 sm:px-8 vcv-menu__canvas"
        >
          {/* The journey column — the canvas's relationship to the rail. */}
          <div className="vcv-menu__journey">
            <p className="vcv-menu__eyebrow">The journey</p>
            <JourneyRail
              stage={stage}
              interactive={railInteractive}
              variant="overlay"
              onNavigate={onNavigate}
            />
            <p className="vcv-menu__note">
              Begin with an NPI, see where each fact came from, choose what is
              shared, and review what you hold.
            </p>
          </div>

          {/* The destinations — every group present, editorial scale. */}
          <div className="grid grid-cols-3 gap-x-12">
            {NAV_GROUPS.map((group) => (
              <div key={group.id} className="vcv-menu__group">
                <p className="vcv-menu__eyebrow" id={`vcv-menu-group-${group.id}`}>
                  {group.label}
                </p>
                <ul aria-labelledby={`vcv-menu-group-${group.id}`} className="vcv-menu__list">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={isRouteActive(pathname, link.href) ? 'page' : undefined}
                        onClick={() => onNavigate(link.label)}
                        className="group/navlink vcv-menu__link"
                      >
                        <span className="vcv-menu__link-label">
                          {link.label}
                          {/* Finite, never looping: the arrow steps out on
                              hover and stops. CD-11 forbids idle motion. */}
                          <span
                            aria-hidden="true"
                            className="translate-x-0 transition-transform duration-150 group-hover/navlink:translate-x-1 motion-reduce:transition-none motion-reduce:transform-none"
                          >
                            →
                          </span>
                        </span>
                        <span className="vcv-menu__link-detail">{link.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="vcv-menu__blurb">{group.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeaderMenu;
