'use client';

/**
 * ProductChrome — UX-03.
 *
 * The navigation instrument for signed-in product surfaces. Before this, the
 * chrome registry had exactly two branches — public (eyebrow + nav + footer)
 * and ops (AppShell) — and every other route fell through to nothing. That is
 * why 39 routes, including the whole employer console and the whole issuer
 * tree, shipped with no header, no nav landmark, and in 30 cases not one
 * in-app link: a person who landed there could only leave via browser-back.
 *
 * This is the missing third branch. It renders a bar at the eyebrow's exact
 * geometry plus the breadcrumb trail, and it self-suppresses everywhere else,
 * so the registry stays the single chrome decision.
 *
 * It deliberately does NOT render the eyebrow's marketing index or its
 * contextual CTA. A person mid-review needs to know where they are and how to
 * get back, not a link to /pricing.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { RouteTrail } from '@/components/navigation/RouteTrail';
import { isProductSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import {
  matchRoutePattern,
  ROUTE_MANIFEST,
  SECTION_ROOTS,
  type ProductSection,
} from '@/lib/navigation/routeManifest';

/** How each section names itself in the bar. */
const SECTION_LABEL: Record<ProductSection, string> = {
  clinician: 'Clinician',
  employer: 'Employer',
  issuer: 'Issuer',
  admin: 'Admin',
  ops: 'Operations',
  account: 'Account',
};

export function ProductChrome() {
  const pathname = usePathname() ?? '/';

  // The holder tree carries its own frame (HolderWorkspaceFrame) and mounts the
  // trail itself; this bar would be a second header there.
  if (!isProductSurfacePath(pathname)) return null;

  const pattern = matchRoutePattern(pathname);
  const node = pattern ? ROUTE_MANIFEST[pattern] : null;
  const section = node?.section ?? null;

  // `account` is a cross-cutting section, not a place with its own console —
  // fall back to naming the tree the surface actually lives in.
  const displaySection: ProductSection | null =
    section === 'account' ? inferSectionFromPath(pathname) : section;

  const rootHref = displaySection ? SECTION_ROOTS[displaySection] : null;
  const rootIsLinkable = Boolean(
    rootHref && !ROUTE_MANIFEST[rootHref]?.unlinked && rootHref !== pathname,
  );

  return (
    <>
      <header className="vcv-pc z-50" data-product-section={displaySection ?? 'unknown'}>
        <div className="vcv-pc__bar">
          <div className="vcv-pc__left">
            <Link href="/" className="vcv-pc__wordmark">
              VitalCV
            </Link>
            {displaySection && (
              <span className="vcv-pc__section">{SECTION_LABEL[displaySection]}</span>
            )}
          </div>
          <div className="vcv-pc__right">
            {rootIsLinkable && rootHref && (
              <Link href={rootHref} className="vcv-pc__link">
                {ROUTE_MANIFEST[rootHref]?.label ?? 'Overview'}
              </Link>
            )}
            {/*
              Account + sign out.

              The clinician tree has had this since HolderDesktopNav; the
              employer, issuer, admin and ops consoles never did, because they
              had no chrome at all — so a signed-in employer had NO WAY TO SIGN
              OUT of their own console short of clearing cookies. UX-03 gave
              those surfaces a bar; this puts the one account control that is
              actually wired into it.

              Deliberately just Clerk's UserButton (manage account, sign out).
              It is not an employer settings surface: organization membership,
              roles and seat management are org-governance product decisions,
              recorded as the open dependency in the authed-navigation audit and
              NOT invented here. Same `afterSignOutUrl` as the holder tree so
              signing out lands in one place across the product.
            */}
            {CLERK_PROVIDER_ENABLED ? <UserButton afterSignOutUrl="/" /> : null}
          </div>
        </div>
      </header>
      <RouteTrail />
    </>
  );
}

/**
 * Which console a cross-cutting surface (settings, organization profile) sits
 * inside.
 *
 * The clinician arm is a regex rather than a prefix comparison against a bare
 * quoted string: that namespace is golden with no root page, so any quoted
 * bare form of it — in code or in a comment — mints a dead URL and fails the
 * repo-wide sweep in holder-route-contract.test.ts.
 */
function inferSectionFromPath(pathname: string): ProductSection | null {
  if (pathname.startsWith('/employer')) return 'employer';
  if (pathname.startsWith('/holder') || /^\/clinician\/.+/.test(pathname)) return 'clinician';
  if (pathname.startsWith('/issuer')) return 'issuer';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/ops')) return 'ops';
  return null;
}

export default ProductChrome;
